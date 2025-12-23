// app/(main)/wizard.tsx
// Quote Wizard - AI-assisted quote building with Drew

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { GradientBackground } from '@/components/GradientBackground';
import {
  sendWizardMessage,
  buildCatalogContext,
  type WizardMessage,
  type WizardTool,
} from '@/lib/wizardApi';
import { useProducts } from '@/modules/catalog/useProducts';
import { createQuote, updateQuote, type Quote, type QuoteItem } from '@/modules/quotes';

type WizardState = 'intro' | 'chat';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

// Draft quote being built by Drew
type DraftQuote = {
  name: string;
  clientName: string;
  items: QuoteItem[];
  labor: number;
  markupPercent: number;
};

export default function WizardScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { categories, products } = useProducts();

  const [state, setState] = useState<WizardState>('intro');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTools, setPendingTools] = useState<WizardTool[]>([]);
  const [draftQuote, setDraftQuote] = useState<DraftQuote>({
    name: '',
    clientName: '',
    items: [],
    labor: 0,
    markupPercent: 0,
  });

  // Speech recognition - only initialize when user is in chat mode
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const speechModuleRef = useRef<any>(null);

  // Load speech module only when entering chat (not on every render)
  useEffect(() => {
    if (state !== 'chat') return;

    let mounted = true;

    // Try to load speech recognition module
    try {
      const module = require('@jamsch/expo-speech-recognition');
      if (mounted) {
        speechModuleRef.current = module.ExpoSpeechRecognitionModule;
        setSpeechAvailable(true);

        // Set up event listeners using addListener pattern
        const startSub = module.ExpoSpeechRecognitionModule.addListener('start', () => {
          if (mounted) setIsListening(true);
        });
        const endSub = module.ExpoSpeechRecognitionModule.addListener('end', () => {
          if (mounted) setIsListening(false);
        });
        const resultSub = module.ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
          const transcript = event.results?.[0]?.transcript;
          if (transcript && mounted) {
            setInputText(transcript);
          }
        });
        const errorSub = module.ExpoSpeechRecognitionModule.addListener('error', () => {
          if (mounted) setIsListening(false);
        });

        // Cleanup subscriptions on unmount
        return () => {
          mounted = false;
          startSub?.remove?.();
          endSub?.remove?.();
          resultSub?.remove?.();
          errorSub?.remove?.();
        };
      }
    } catch (e) {
      // Speech recognition not available (Expo Go)
      console.log('Speech recognition not available');
    }

    return () => {
      mounted = false;
    };
  }, [state]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Build catalog context for the AI
  const catalogContext = React.useMemo(() => {
    if (!categories.length || !products.length) return undefined;
    return buildCatalogContext(categories, products);
  }, [categories, products]);

  const handleStart = () => {
    setState('chat');
    // Add Drew's opening message
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Great! Tell me about the project. What kind of work are you quoting?",
      },
    ]);
  };

  const handleMaybeLater = () => {
    router.back();
  };

  const handleMicPress = useCallback(async () => {
    if (!speechModuleRef.current) return;

    if (isListening) {
      speechModuleRef.current.stop();
    } else {
      const result = await speechModuleRef.current.requestPermissionsAsync();
      if (!result.granted) {
        console.log('Speech permission not granted');
        return;
      }

      speechModuleRef.current.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
      });
    }
  }, [isListening]);


  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Convert to API format (without id)
      const apiMessages: WizardMessage[] = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendWizardMessage(apiMessages, catalogContext);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message || "I'm thinking...",
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Handle any tool calls from the AI
      if (response.toolCalls && response.toolCalls.length > 0) {
        setPendingTools(response.toolCalls);
        // Show what actions Drew wants to take
        const toolSummary = response.toolCalls
          .map(t => {
            switch (t.type) {
              case 'addItem': return `Add ${t.qty}x ${t.productName}`;
              case 'setLabor': return `Set labor: ${t.hours}hrs @ $${t.rate}/hr`;
              case 'applyMarkup': return `Apply ${t.percent}% markup`;
              case 'setClientName': return `Client: ${t.name}`;
              case 'setQuoteName': return `Quote: ${t.name}`;
              case 'suggestAssembly': return `Use assembly: ${t.assemblyName}`;
              default: return '';
            }
          })
          .filter(Boolean)
          .join('\n');

        if (toolSummary) {
          Alert.alert(
            'Drew suggests:',
            toolSummary,
            [
              { text: 'Skip', style: 'cancel', onPress: () => setPendingTools([]) },
              { text: 'Apply', onPress: () => applyPendingTools(response.toolCalls!) },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Wizard API error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const applyPendingTools = async (tools: WizardTool[]) => {
    console.log('Applying tools:', tools);

    // Apply each tool to the draft quote
    let updatedDraft = { ...draftQuote };
    const appliedActions: string[] = [];

    for (const tool of tools) {
      switch (tool.type) {
        case 'setQuoteName':
          updatedDraft.name = tool.name;
          appliedActions.push(`Named quote "${tool.name}"`);
          break;
        case 'setClientName':
          updatedDraft.clientName = tool.name;
          appliedActions.push(`Set client to "${tool.name}"`);
          break;
        case 'addItem':
          updatedDraft.items = [
            ...updatedDraft.items,
            {
              id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              productId: tool.productId,
              name: tool.productName,
              qty: tool.qty,
              unitPrice: tool.unitPrice,
            },
          ];
          appliedActions.push(`Added ${tool.qty}x ${tool.productName}`);
          break;
        case 'setLabor':
          updatedDraft.labor = tool.hours * tool.rate;
          appliedActions.push(`Set labor to ${tool.hours}hrs @ $${tool.rate}/hr`);
          break;
        case 'applyMarkup':
          updatedDraft.markupPercent = tool.percent;
          appliedActions.push(`Applied ${tool.percent}% markup`);
          break;
      }
    }

    setDraftQuote(updatedDraft);
    setPendingTools([]);

    const confirmMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Done! ${appliedActions.join(', ')}. What else do you need?`,
    };
    setMessages((prev) => [...prev, confirmMessage]);
  };

  const saveQuoteAndExit = async () => {
    if (!draftQuote.name && draftQuote.items.length === 0) {
      Alert.alert('Empty Quote', 'Add some items before saving.');
      return;
    }

    try {
      // Create the quote first
      const newQuote = await createQuote(
        draftQuote.name || 'Untitled Quote',
        draftQuote.clientName || '',
      );

      // Then update with items, labor, markup
      await updateQuote(newQuote.id, {
        items: draftQuote.items,
        labor: draftQuote.labor,
        markupPercent: draftQuote.markupPercent,
      });

      Alert.alert(
        'Quote Created!',
        `"${newQuote.name}" has been saved.`,
        [{ text: 'View Quote', onPress: () => router.push(`/(forms)/quote/${newQuote.id}/edit` as any) },
         { text: 'Done', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to save quote:', error);
      Alert.alert('Error', 'Failed to save quote. Please try again.');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Quote Wizard',
          headerShown: true,
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          {state === 'intro' ? (
            <View style={styles.introContainer}>
              {/* Drew's avatar placeholder */}
              <View style={styles.avatarContainer}>
                <Ionicons name="chatbubble-ellipses" size={48} color={theme.colors.accent} />
              </View>

              <Text style={styles.greeting}>Hey, I&apos;m Drew!</Text>
              <Text style={styles.subtitle}>
                Would you like me to help you draft a quote?
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleStart}
                >
                  <Text style={styles.primaryButtonText}>Let&apos;s go</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleMaybeLater}
                >
                  <Text style={styles.secondaryButtonText}>Maybe later</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.chatContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={100}
            >
              {/* Chat messages area */}
              <ScrollView
                ref={scrollRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        msg.role === 'user' && styles.userMessageText,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                ))}
                {isLoading && (
                  <View style={[styles.messageBubble, styles.assistantBubble]}>
                    <ActivityIndicator size="small" color={theme.colors.muted} />
                  </View>
                )}

                {/* Show draft summary if we have items */}
                {(draftQuote.name || draftQuote.items.length > 0) && (
                  <View style={styles.draftSummary}>
                    <Text style={styles.draftTitle}>
                      {draftQuote.name || 'Draft Quote'}
                    </Text>
                    <Text style={styles.draftInfo}>
                      {draftQuote.items.length} items
                      {draftQuote.labor > 0 ? ` • $${draftQuote.labor} labor` : ''}
                    </Text>
                    <Pressable style={styles.saveButton} onPress={saveQuoteAndExit}>
                      <Ionicons name="checkmark-circle" size={18} color="#000" />
                      <Text style={styles.saveButtonText}>Save Quote</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>

              {/* Input area */}
              <View style={styles.inputContainer}>
                {speechAvailable && (
                  <Pressable
                    style={[
                      styles.micButton,
                      isListening && styles.micButtonActive,
                    ]}
                    onPress={handleMicPress}
                  >
                    <Ionicons
                      name={isListening ? 'mic' : 'mic-outline'}
                      size={24}
                      color={isListening ? '#fff' : theme.colors.accent}
                    />
                  </Pressable>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder={speechAvailable ? "Type or tap mic to speak..." : "Type your message..."}
                  placeholderTextColor={theme.colors.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    { opacity: inputText.trim() && !isLoading ? 1 : 0.5 },
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Ionicons name="send" size={20} color="#000" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    // Intro styles
    introContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: `${theme.colors.accent}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    greeting: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 18,
      color: theme.colors.muted,
      textAlign: 'center',
      marginBottom: 32,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: theme.radius.md,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000',
    },
    secondaryButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.muted,
    },
    // Chat styles
    chatContainer: {
      flex: 1,
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      padding: 16,
      gap: 12,
    },
    messageBubble: {
      padding: 14,
      borderRadius: theme.radius.md,
      maxWidth: '85%',
    },
    assistantBubble: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignSelf: 'flex-start',
    },
    userBubble: {
      backgroundColor: theme.colors.accent,
      alignSelf: 'flex-end',
    },
    messageText: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 22,
    },
    userMessageText: {
      color: '#000',
    },
    draftSummary: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      padding: 14,
      marginTop: 8,
    },
    draftTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    draftInfo: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 4,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      marginTop: 12,
      gap: 6,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#000',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    micButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${theme.colors.accent}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    textInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.colors.text,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
