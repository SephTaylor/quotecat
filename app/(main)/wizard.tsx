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
  searchCatalog,
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
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
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

  // Load speech module only in native builds (not Expo Go)
  useEffect(() => {
    if (state !== 'chat') return;

    let mounted = true;
    let cleanup: (() => void) | undefined;

    // Only try to load in production/native builds
    // __DEV__ is false in production builds where native modules work
    if (!__DEV__) {
      import('@jamsch/expo-speech-recognition')
        .then((module: any) => {
          if (!mounted || !module.ExpoSpeechRecognitionModule) return;

          speechModuleRef.current = module.ExpoSpeechRecognitionModule;
          setSpeechAvailable(true);

          // Set up event listeners
          const speechModule = module.ExpoSpeechRecognitionModule;
          const startSub = speechModule.addListener('start', () => {
            if (mounted) setIsListening(true);
          });
          const endSub = speechModule.addListener('end', () => {
            if (mounted) setIsListening(false);
          });
          const resultSub = speechModule.addListener('result', (event: any) => {
            const transcript = event.results?.[0]?.transcript;
            if (transcript && mounted) {
              setInputText(transcript);
            }
          });
          const errorSub = speechModule.addListener('error', () => {
            if (mounted) setIsListening(false);
          });

          cleanup = () => {
            startSub?.remove?.();
            endSub?.remove?.();
            resultSub?.remove?.();
            errorSub?.remove?.();
          };
        })
        .catch(() => {
          // Speech recognition not available
          console.log('Speech recognition not available');
        });
    }

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [state]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Helper to search the catalog (used when Drew calls searchCatalog tool)
  const handleCatalogSearch = React.useCallback((query: string, category?: string, limit?: number): string => {
    if (!products.length || !categories.length) {
      return 'Catalog not loaded yet. Please try again.';
    }
    return searchCatalog(products, categories, query, category, limit);
  }, [products, categories]);

  // Generate quick reply options based on Drew's message
  const generateQuickReplies = (message: string): string[] => {
    const lower = message.toLowerCase();

    // Check what Drew is asking about - use the LAST question in the message
    // to determine what options to show

    // Budget questions (check first - often combined with other questions)
    if (lower.includes('budget') || (lower.includes('standard') && lower.includes('premium'))) {
      return ['Budget-friendly', 'Mid-range', 'Premium'];
    }

    // Ceiling height questions
    if (lower.includes('ceiling') && lower.includes('height')) {
      return ['8 ft', '9 ft', '10 ft'];
    }

    // Full gut vs keeping existing
    if (lower.includes('gut') || lower.includes('keeping') || lower.includes('existing')) {
      return ['Full gut job', 'Keeping existing plumbing'];
    }

    // Preference/choice questions
    if (lower.includes('which') || lower.includes('prefer') || lower.includes('would you like')) {
      if (lower.includes('toilet')) {
        return ['Standard', 'Comfort height'];
      }
      if (lower.includes('vanity') || lower.includes('sink')) {
        return ['Drop-in', 'Undermount'];
      }
      return ['Go with defaults', 'Let me choose'];
    }

    // Confirmation questions
    if (lower.includes('sound good') || lower.includes('look good') || lower.includes('ready to add') || lower.includes('shall i add') || lower.includes('add these')) {
      return ['Yes, add them', 'Make changes'];
    }

    // Dimension questions - only if specifically asking for dimensions
    if (lower.includes('dimension') || lower.includes('how big') || (lower.includes('what') && lower.includes('size') && !lower.includes('nice size'))) {
      return ['8x10', '10x12', '12x14', '12x16'];
    }

    // General project type
    if (lower.includes('what kind') || lower.includes('what type') || lower.includes('tell me about')) {
      return ['Bathroom', 'Kitchen', 'Framing', 'Electrical'];
    }

    return [];
  };

  const handleQuickReply = (reply: string) => {
    handleSendWithMessage(reply);
  };

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


  const handleSendWithMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
    };

    let currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setQuickReplies([]); // Clear quick replies when sending
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    await sendMessageLoop(currentMessages);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    await handleSendWithMessage(text);
  };

  const sendMessageLoop = async (currentMessages: Message[]) => {

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Loop to handle searchCatalog tool calls (Drew searches, we respond, Drew continues)
      let maxIterations = 5; // Prevent timeout - fewer iterations
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        // Convert to API format (without id)
        const apiMessages: WizardMessage[] = currentMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        // Don't send catalogContext - Drew will use searchCatalog tool instead
        const response = await sendWizardMessage(apiMessages);

        // Check for searchCatalog tool calls - handle them automatically
        const searchCalls = response.toolCalls?.filter(t => t.type === 'searchCatalog') || [];
        const otherCalls = response.toolCalls?.filter(t => t.type !== 'searchCatalog') || [];

        if (searchCalls.length > 0) {
          // Execute searches locally
          const searchResults = searchCalls.map(t => {
            if (t.type === 'searchCatalog') {
              const result = handleCatalogSearch(t.query, t.category, t.limit);
              return `Search for "${t.query}": ${result}`;
            }
            return '';
          }).join('\n\n');

          // Add Drew's message if there is one (for display only)
          if (response.message) {
            const assistantMessage: Message = {
              id: (Date.now() + iteration).toString(),
              role: 'assistant',
              content: response.message,
            };
            // Only update UI display
            setMessages((prev) => [...prev, assistantMessage]);
            // Add to conversation for API
            currentMessages = [...currentMessages, assistantMessage];
          }

          // Add search results to conversation for API (not displayed to user)
          // Use 'user' role so Claude sees it as tool result and continues
          currentMessages = [...currentMessages, {
            id: (Date.now() + iteration + 1).toString(),
            role: 'user' as const,
            content: `[Catalog Search Results]\n${searchResults}`,
          }];

          // Continue the loop so Drew processes the results
          continue;
        }

        // No search calls - add the final response
        const assistantMessage: Message = {
          id: (Date.now() + iteration).toString(),
          role: 'assistant',
          content: response.message || "I'm thinking...",
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Handle other tool calls (addItem, setLabor, etc.) - show inline
        if (otherCalls.length > 0) {
          setPendingTools(otherCalls);
        }

        // Generate quick replies if Drew is asking questions
        const message = response.message || '';
        const replies = generateQuickReplies(message);
        setQuickReplies(replies);

        // Exit the loop - we're done
        break;
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

                {/* Show pending suggestions from Drew */}
                {pendingTools.length > 0 && (
                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionTitle}>Drew suggests:</Text>
                    {pendingTools.map((tool, index) => {
                      let label = '';
                      switch (tool.type) {
                        case 'addItem': label = `Add ${tool.qty}x ${tool.productName}`; break;
                        case 'setLabor': label = `Set labor: ${tool.hours}hrs @ $${tool.rate}/hr`; break;
                        case 'applyMarkup': label = `Apply ${tool.percent}% markup`; break;
                        case 'setClientName': label = `Client: ${tool.name}`; break;
                        case 'setQuoteName': label = `Quote: ${tool.name}`; break;
                        case 'suggestAssembly': label = `Use assembly: ${tool.assemblyName}`; break;
                      }
                      return (
                        <Text key={index} style={styles.suggestionItem}>• {label}</Text>
                      );
                    })}
                    <View style={styles.suggestionButtons}>
                      <Pressable
                        style={styles.suggestionButtonSkip}
                        onPress={() => setPendingTools([])}
                      >
                        <Text style={styles.suggestionButtonSkipText}>Skip</Text>
                      </Pressable>
                      <Pressable
                        style={styles.suggestionButtonApply}
                        onPress={() => applyPendingTools(pendingTools)}
                      >
                        <Text style={styles.suggestionButtonApplyText}>Apply All</Text>
                      </Pressable>
                    </View>
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

              {/* Quick reply chips */}
              {quickReplies.length > 0 && !isLoading && (
                <View style={styles.quickRepliesContainer}>
                  {quickReplies.map((reply, index) => (
                    <Pressable
                      key={index}
                      style={styles.quickReplyChip}
                      onPress={() => handleQuickReply(reply)}
                    >
                      <Text style={styles.quickReplyText}>{index + 1}. {reply}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

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
    quickRepliesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    quickReplyChip: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    quickReplyText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    suggestionCard: {
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      padding: 14,
      marginTop: 8,
    },
    suggestionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.accent,
      marginBottom: 8,
    },
    suggestionItem: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 4,
      lineHeight: 20,
    },
    suggestionButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    suggestionButtonSkip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    suggestionButtonSkipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.muted,
    },
    suggestionButtonApply: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
    },
    suggestionButtonApplyText: {
      fontSize: 14,
      fontWeight: '600',
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
