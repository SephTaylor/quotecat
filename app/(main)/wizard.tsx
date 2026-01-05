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
  Alert,
  Image,
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
  createInitialState,
  type WizardState as ServerWizardState,
  type WizardTool,
  type WizardDisplay,
  type UserDefaults,
} from '@/lib/wizardApi';
import { useProducts } from '@/modules/catalog/useProducts';
import { createQuote, updateQuote, type QuoteItem } from '@/modules/quotes';
import { loadPreferences } from '@/lib/preferences';
import { getUserState } from '@/lib/user';
import { canAccessWizard } from '@/lib/features';

type ScreenState = 'intro' | 'chat' | 'upgrade';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  display?: WizardDisplay;
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

  const [screenState, setScreenState] = useState<ScreenState>('intro');
  const [wizardState, setWizardState] = useState<ServerWizardState>(createInitialState());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<'none' | 'remove' | 'quantity'>('none');
  // Track product selections: { productId: quantity }
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [draftQuote, setDraftQuote] = useState<DraftQuote>({
    name: '',
    clientName: '',
    items: [],
    labor: 0,
    markupPercent: 0,
  });
  // User defaults loaded from preferences
  const [userDefaults, setUserDefaults] = useState<UserDefaults>({});

  // Check tier access on mount
  useEffect(() => {
    getUserState().then(user => {
      if (!canAccessWizard(user)) {
        setScreenState('upgrade');
      }
    });
  }, []);

  // Load user preferences on mount
  useEffect(() => {
    loadPreferences().then(prefs => {
      setUserDefaults({
        defaultMarkupPercent: prefs.pricing?.defaultMarkupPercent || undefined,
        defaultLaborRate: prefs.pricing?.defaultLaborRate || undefined,
      });
    });
  }, []);

  // Speech recognition - only initialize when user is in chat mode
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const speechModuleRef = useRef<any>(null);

  // Load speech module only in native builds (not Expo Go)
  useEffect(() => {
    if (screenState !== 'chat') return;

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
  }, [screenState]);

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

    // Budget/finish level questions (most common)
    if (lower.includes('budget') || lower.includes('finish') ||
        (lower.includes('standard') && lower.includes('premium')) ||
        lower.includes('level of finish')) {
      return ['Budget', 'Standard', 'Premium'];
    }

    // Size/dimension questions
    if (lower.includes('what size') || lower.includes('how big') ||
        lower.includes('dimensions') || lower.includes('square feet') ||
        (lower.includes('size') && lower.includes('?'))) {
      return ['Small (5x8)', 'Medium (8x10)', 'Large (10x12)'];
    }

    // Ceiling height
    if (lower.includes('ceiling') && (lower.includes('height') || lower.includes('tall'))) {
      return ['8 ft', '9 ft', '10 ft'];
    }

    // Scope questions (full reno vs partial)
    if (lower.includes('gut') || lower.includes('keeping') ||
        lower.includes('existing') || lower.includes('scope') ||
        lower.includes('full') || lower.includes('partial')) {
      return ['Full remodel', 'Keep plumbing', 'Cosmetic only'];
    }

    // Product preference questions (which/prefer/like)
    if (lower.includes('which') || lower.includes('prefer') || lower.includes('works for')) {
      // Try to detect the product type
      if (lower.includes('toilet')) return ['Standard', 'Comfort height', 'Elongated'];
      if (lower.includes('vanity') || lower.includes('sink')) return ['Single sink', 'Double sink'];
      if (lower.includes('tile')) return ['Ceramic', 'Porcelain', 'Natural stone'];
      if (lower.includes('floor')) return ['Tile', 'Vinyl', 'Hardwood'];
      // Generic numbered options if we can extract them
      return ['Option 1', 'Option 2', 'Let me think'];
    }

    // Confirmation questions
    if (lower.includes('sound good') || lower.includes('look good') ||
        lower.includes('ready to add') || lower.includes('shall i') ||
        lower.includes('add these') || lower.includes('go ahead') ||
        lower.includes('want me to')) {
      return ['Yes, add them', 'Make changes', 'Start over'];
    }

    // Project type questions (at the start)
    if (lower.includes('what kind') || lower.includes('what type') ||
        lower.includes('tell me about') || lower.includes('working on') ||
        lower.includes('quoting')) {
      return ['Bathroom', 'Kitchen', 'Bedroom', 'Other'];
    }

    // Anything else question
    if (lower.includes('anything else') || lower.includes('what else') ||
        lower.includes('need anything')) {
      return ['Add labor', 'Add markup', 'Done for now'];
    }

    // Labor questions
    if (lower.includes('labor') || lower.includes('hours')) {
      return ['Light (8 hrs)', 'Medium (16 hrs)', 'Heavy (24+ hrs)'];
    }

    return [];
  };

  // Toggle product selection
  const toggleSelection = (productId: string, suggestedQty: number) => {
    setSelections(prev => {
      if (prev[productId] !== undefined) {
        // Remove selection
        const { [productId]: _, ...rest } = prev;
        return rest;
      } else {
        // Add selection with suggested qty
        return { ...prev, [productId]: suggestedQty };
      }
    });
  };

  // Update quantity for a selected product
  const updateSelectionQty = (productId: string, qty: number) => {
    if (qty < 1) qty = 1;
    setSelections(prev => ({ ...prev, [productId]: qty }));
  };

  // Send batch selections to server
  const submitSelections = () => {
    const selectionArray = Object.entries(selections).map(([id, qty]) => ({ id, qty }));
    if (selectionArray.length === 0) return;

    // Machine-readable message for API
    const apiMessage = `ADD_SELECTED:${JSON.stringify(selectionArray)}`;

    setSelections({}); // Clear selections
    handleSendWithMessage(apiMessage, "Added");
  };

  const handleQuickReply = (reply: string) => {
    if (reply === 'Save Quote') {
      saveQuoteAndExit();
      return;
    }
    if (reply === 'Start Over') {
      handleStart();
      return;
    }
    if (reply === 'Add Selected') {
      submitSelections();
      return;
    }
    // Clear selections when moving on
    setSelections({});
    handleSendWithMessage(reply);
  };

  const handleStart = async () => {
    setScreenState('chat');
    setIsLoading(true);
    const initialState = createInitialState();
    setWizardState(initialState);
    setMessages([]);

    try {
      // Get Drew's opening message from the state machine
      const response = await sendWizardMessage('', initialState, userDefaults);

      setWizardState(response.state || initialState);
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: response.message || "Hey! What kind of project are we quoting?",
        },
      ]);

      // Use quick replies from server if provided
      if (response.quickReplies && response.quickReplies.length > 0) {
        setQuickReplies(response.quickReplies);
      }
    } catch (error) {
      console.error('Failed to start wizard:', error);
      // Fallback to local opener
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: "Hey! What kind of project are we quoting?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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


  // displayText is what the user sees in chat; messageText is what's sent to the API
  const handleSendWithMessage = async (messageText: string, displayText?: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayText || messageText.trim(),
    };

    let currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setQuickReplies([]); // Clear quick replies when sending
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    await sendMessageLoop(currentMessages, messageText.trim());
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    await handleSendWithMessage(text);
  };

  // Silently apply tools to the draft quote (no confirmation message)
  const applyToolsSilently = (tools: WizardTool[]) => {
    for (const tool of tools) {
      // Handle UI mode switches separately
      if (tool.type === 'showRemoveItem') {
        setEditMode('remove');
        continue;
      }
      if (tool.type === 'showEditQuantity') {
        setEditMode('quantity');
        continue;
      }
    }

    setDraftQuote(prev => {
      let updated = { ...prev };
      for (const tool of tools) {
        switch (tool.type) {
          case 'setQuoteName':
            updated.name = tool.name;
            break;
          case 'setClientName':
            updated.clientName = tool.name;
            break;
          case 'addItem':
            updated.items = [
              ...updated.items,
              {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                productId: tool.productId,
                name: tool.productName,
                qty: tool.qty,
                unitPrice: tool.unitPrice,
              },
            ];
            break;
          case 'setLabor':
            updated.labor = tool.hours * tool.rate;
            break;
          case 'applyMarkup':
            updated.markupPercent = tool.percent;
            break;
        }
      }
      return updated;
    });
  };

  // Remove an item by index
  const removeItem = (index: number) => {
    setDraftQuote(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    setEditMode('none');
    // Add confirmation message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Removed! Anything else?',
    }]);
    setQuickReplies(['Save Quote', 'Make Changes', 'Start Over']);
  };

  // Update quantity for an item
  const updateItemQty = (index: number, newQty: number) => {
    setDraftQuote(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, qty: newQty } : item),
    }));
    setEditMode('none');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Updated to ${newQty}! Anything else?`,
    }]);
    setQuickReplies(['Save Quote', 'Make Changes', 'Start Over']);
  };

  // apiMessage is what's sent to the API (may differ from displayed message)
  const sendMessageLoop = async (currentMessages: Message[], apiMessage?: string) => {
    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Use provided apiMessage, or fall back to last displayed user message
      const lastUserMessage = currentMessages.filter(m => m.role === 'user').pop();
      const userMessageText = apiMessage || lastUserMessage?.content || '';

      // Call the state machine API
      const response = await sendWizardMessage(userMessageText, wizardState, userDefaults);

      // Update state from response
      if (response.state) {
        setWizardState(response.state);
      }

      // Add Drew's response with structured display data
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.message || "I'm thinking...",
        display: response.display,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-apply tool calls (addItem, setLabor, etc.) silently
      if (response.toolCalls && response.toolCalls.length > 0) {
        applyToolsSilently(response.toolCalls);
      }

      // Use quick replies from server (state machine provides them)
      // Fall back to local generation if server doesn't provide any
      if (response.quickReplies && response.quickReplies.length > 0) {
        setQuickReplies(response.quickReplies);
      } else {
        const message = response.message || '';
        const replies = generateQuickReplies(message);
        setQuickReplies(replies);
      }
    } catch (error) {
      console.error('Wizard API error:', error);
      // Drew-style error messages
      const errorMessages = [
        "Hmm, lost my train of thought there. Mind saying that again?",
        "Signal's a bit spotty. Let's try that again.",
        "Hit a snag on my end. One more time?",
        "My brain froze for a sec. What were we talking about?",
      ];
      const randomError = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: randomError,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
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
          {screenState === 'upgrade' ? (
            <View style={styles.introContainer}>
              {/* Drew's avatar */}
              <Image
                source={require('@/assets/images/drew-avatar.png')}
                style={styles.drewAvatar}
              />

              <Text style={styles.greeting}>Meet Drew!</Text>
              <Text style={styles.subtitle}>
                Drew is your AI-powered quote assistant. He can help you build quotes faster using voice or text.
              </Text>
              <Text style={[styles.subtitle, { marginTop: 16, color: theme.colors.accent }]}>
                Drew is a Premium feature.
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => router.push('/(main)/(tabs)/pro-tools')}
                >
                  <Text style={styles.primaryButtonText}>Learn More</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.secondaryButtonText}>Maybe later</Text>
                </Pressable>
              </View>
            </View>
          ) : screenState === 'intro' ? (
            <View style={styles.introContainer}>
              {/* Drew's avatar */}
              <Image
                source={require('@/assets/images/drew-avatar.png')}
                style={styles.drewAvatar}
              />

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
                  <View key={msg.id}>
                    <View
                      style={[
                        styles.messageRow,
                        msg.role === 'user' && styles.userMessageRow,
                      ]}
                    >
                      {msg.role === 'assistant' && (
                        <Image
                          source={require('@/assets/images/drew-avatar.png')}
                          style={styles.chatAvatar}
                        />
                      )}
                      <View
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
                    </View>

                    {/* Structured display data - products with multi-select */}
                    {msg.display?.type === 'products' && msg.display.products && (
                      <View style={styles.displayCard}>
                        <Text style={styles.displayCardHeader}>Select items and adjust quantities:</Text>
                        {msg.display.products.map((product) => {
                          const isSelected = selections[product.id] !== undefined;
                          const qty = selections[product.id] ?? product.suggestedQty;
                          return (
                            <View key={product.id} style={styles.productRow}>
                              {/* Checkbox */}
                              <Pressable
                                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                                onPress={() => toggleSelection(product.id, product.suggestedQty)}
                              >
                                {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
                              </Pressable>

                              {/* Product info */}
                              <Pressable
                                style={styles.productInfo}
                                onPress={() => toggleSelection(product.id, product.suggestedQty)}
                              >
                                <Text style={styles.productName}>{product.name}</Text>
                                <Text style={styles.productPrice}>
                                  ${product.price.toFixed(2)}/{product.unit}
                                </Text>
                              </Pressable>

                              {/* Qty stepper - only show when selected */}
                              {isSelected && (
                                <View style={styles.qtyStepper}>
                                  <Pressable
                                    style={styles.qtyButton}
                                    onPress={() => updateSelectionQty(product.id, qty - 1)}
                                  >
                                    <Text style={styles.qtyButtonText}>−</Text>
                                  </Pressable>
                                  <Text style={styles.qtyValue}>{qty}</Text>
                                  <Pressable
                                    style={styles.qtyButton}
                                    onPress={() => updateSelectionQty(product.id, qty + 1)}
                                  >
                                    <Text style={styles.qtyButtonText}>+</Text>
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* Add Selected button */}
                        {Object.keys(selections).length > 0 && (
                          <Pressable style={styles.addSelectedButton} onPress={submitSelections}>
                            <Text style={styles.addSelectedText}>
                              Add {Object.keys(selections).length} item{Object.keys(selections).length > 1 ? 's' : ''} to quote
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {msg.display?.type === 'added' && msg.display.addedItems && (
                      <View style={styles.addedCard}>
                        <Text style={styles.addedTitle}>Added to quote:</Text>
                        {msg.display.addedItems.map((item, i) => (
                          <Text key={i} style={styles.addedItem}>
                            {item.qty}x {item.name}
                          </Text>
                        ))}
                        {msg.display.relatedItems && msg.display.relatedItems.length > 0 && (
                          <Text style={styles.relatedHint}>
                            You might also need: {msg.display.relatedItems.join(', ')}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                ))}
                {isLoading && (
                  <View style={styles.messageRow}>
                    <Image
                      source={require('@/assets/images/drew-avatar.png')}
                      style={styles.chatAvatar}
                    />
                    <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, styles.typingDot1]} />
                        <View style={[styles.typingDot, styles.typingDot2]} />
                        <View style={[styles.typingDot, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Quote Summary - shown when done */}
                {wizardState.phase === 'done' && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Quote Summary</Text>

                    {draftQuote.name && (
                      <Text style={styles.summaryLabel}>
                        <Text style={styles.summaryBold}>Quote: </Text>
                        {draftQuote.name}
                      </Text>
                    )}

                    {draftQuote.clientName && (
                      <Text style={styles.summaryLabel}>
                        <Text style={styles.summaryBold}>Client: </Text>
                        {draftQuote.clientName}
                      </Text>
                    )}

                    {draftQuote.items.length > 0 && (
                      <View style={styles.summarySection}>
                        <Text style={styles.summaryBold}>
                          Items ({draftQuote.items.length}):
                          {editMode !== 'none' && <Text style={styles.editHint}> (tap to {editMode === 'remove' ? 'remove' : 'edit'})</Text>}
                        </Text>
                        {draftQuote.items.map((item, i) => (
                          <Pressable
                            key={i}
                            onPress={() => {
                              if (editMode === 'remove') {
                                removeItem(i);
                              } else if (editMode === 'quantity') {
                                Alert.prompt(
                                  'Change Quantity',
                                  `Enter new quantity for ${item.name}:`,
                                  [
                                    { text: 'Cancel', style: 'cancel', onPress: () => setEditMode('none') },
                                    { text: 'Update', onPress: (val: string | undefined) => updateItemQty(i, parseInt(val || '1') || 1) },
                                  ],
                                  'plain-text',
                                  String(item.qty)
                                );
                              }
                            }}
                            style={[
                              styles.summaryItemRow,
                              editMode !== 'none' && styles.summaryItemTappable,
                            ]}
                          >
                            <Text style={[
                              styles.summaryItem,
                              editMode === 'remove' && styles.summaryItemRemove,
                            ]}>
                              • {item.qty}x {item.name} - ${(item.qty * item.unitPrice).toFixed(2)}
                            </Text>
                          </Pressable>
                        ))}
                        {editMode !== 'none' && (
                          <Pressable onPress={() => setEditMode('none')} style={styles.cancelEditBtn}>
                            <Text style={styles.cancelEditText}>Cancel</Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {draftQuote.labor > 0 && (
                      <Text style={styles.summaryLabel}>
                        <Text style={styles.summaryBold}>Labor: </Text>
                        ${draftQuote.labor.toFixed(2)}
                      </Text>
                    )}

                    {draftQuote.markupPercent > 0 && (
                      <Text style={styles.summaryLabel}>
                        <Text style={styles.summaryBold}>Markup: </Text>
                        {draftQuote.markupPercent}%
                      </Text>
                    )}

                    <View style={styles.summaryTotal}>
                      <Text style={styles.summaryTotalLabel}>Total:</Text>
                      <Text style={styles.summaryTotalValue}>
                        ${(() => {
                          const itemsTotal = draftQuote.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
                          const subtotal = itemsTotal + draftQuote.labor;
                          const markup = subtotal * (draftQuote.markupPercent / 100);
                          return (subtotal + markup).toFixed(2);
                        })()}
                      </Text>
                    </View>
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
    drewAvatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
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
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    userMessageRow: {
      justifyContent: 'flex-end',
    },
    chatAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginBottom: 2,
    },
    messageBubble: {
      padding: 14,
      borderRadius: theme.radius.md,
      maxWidth: '80%',
      flexShrink: 1,
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
    typingBubble: {
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    typingDots: {
      flexDirection: 'row',
      gap: 4,
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.muted,
    },
    typingDot1: {
      opacity: 0.4,
    },
    typingDot2: {
      opacity: 0.6,
    },
    typingDot3: {
      opacity: 0.8,
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
    // Display card styles (products, added items)
    displayCard: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      marginLeft: 48, // Align with message bubble (avatar width + gap)
      marginTop: 8,
      overflow: 'hidden',
    },
    displayCardHeader: {
      fontSize: 13,
      color: theme.colors.muted,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    productPrice: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    qtyStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    qtyButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qtyButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.accent,
    },
    qtyValue: {
      minWidth: 36,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    addSelectedButton: {
      backgroundColor: theme.colors.accent,
      margin: 12,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    addSelectedText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#000',
    },
    addedCard: {
      backgroundColor: `${theme.colors.accent}15`,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      marginLeft: 48,
      marginTop: 8,
      padding: 12,
    },
    addedTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.accent,
      marginBottom: 6,
    },
    addedItem: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 8,
      marginBottom: 2,
    },
    relatedHint: {
      fontSize: 13,
      color: theme.colors.muted,
      fontStyle: 'italic',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: `${theme.colors.accent}30`,
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      padding: 16,
      marginTop: 12,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.accent,
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 15,
      color: theme.colors.text,
      marginBottom: 6,
    },
    summaryBold: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    summarySection: {
      marginTop: 8,
      marginBottom: 8,
    },
    summaryItem: {
      fontSize: 14,
      color: theme.colors.muted,
      marginLeft: 8,
      marginTop: 4,
    },
    summaryItemRow: {
      paddingVertical: 4,
    },
    summaryItemTappable: {
      backgroundColor: `${theme.colors.accent}15`,
      borderRadius: 6,
      paddingHorizontal: 8,
      marginLeft: 0,
      marginRight: 4,
    },
    summaryItemRemove: {
      color: theme.colors.danger || '#ff4444',
    },
    editHint: {
      fontWeight: '400',
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: 'italic',
    },
    cancelEditBtn: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
    },
    cancelEditText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    summaryTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    summaryTotalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    summaryTotalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.accent,
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
