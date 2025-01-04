// src/Chat.js
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { Alert, Form, Button, ListGroup, Badge } from 'react-bootstrap';
import './Chat.css';

const POLLING_INTERVAL_MS = 50000; // Poll every 50 seconds

const Chat = ({ xmtpClient, targetAddress }) => {
  // --------------------------------------------------------------------------
  // State variables
  // --------------------------------------------------------------------------
  const [conversationsMap, setConversationsMap] = useState(new Map()); 
  const [conversationAddresses, setConversationAddresses] = useState({}); 
  const [selectedConversationId, setSelectedConversationId] = useState(null); 
  // 1 & 5) Store messages keyed by conversation ID
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [messageText, setMessageText] = useState(''); 
  const [error, setError] = useState(null); 
  const [unreadCounts, setUnreadCounts] = useState({});

  const pollingIntervalRef = useRef(null);
  const prevTargetAddressRef = useRef(targetAddress); // 15) Track changes to targetAddress

  // --------------------------------------------------------------------------
  // Helper functions
  // --------------------------------------------------------------------------
  const getInboxId = useCallback((conv) => {
    if (!conv.cachedInboxId) {
      conv.cachedInboxId = conv.dmPeerInboxId().value;
    }
    return conv.cachedInboxId;
  }, []);

  const isDescriptionValid = (description = '') => {
    const parts = description.split('-');
    return parts.length === 2 && parts[0] && parts[1];
  };

  const parseDescription = useCallback((description, myAddress) => {
    if (!description || !isDescriptionValid(description)) {
      return 'Unknown';
    }
    const parts = description.split('-');
    // If the first part is my address, the second part is the peer address; otherwise vice versa.
    return parts[0].toLowerCase() === myAddress.toLowerCase()
      ? parts[1]
      : parts[0];
  }, []);

  /**
   * Only set or fix the conversation description if it's missing or invalid.
   * We call this on the initial fetch or new conv creation, not on every poll.
   */
  const ensureDescription = useCallback(
    async (conv, myAddress) => {
      let description = conv.description;
      if (!description || !isDescriptionValid(description)) {
        let peerAddress = targetAddress;
        // If no targetAddress was specified, we try members. (But for DM, members might be 0.)
        if (!peerAddress) {
          try {
            // For DMs, members is often 0; for group chats, it might be more
            const members = (await conv.members()) || [];
            // If there's exactly 1 other member, use it
            if (members.length === 1) {
              peerAddress = members[0];
            } else if (members.length > 1) {
              // If group, you might do something else, but for now we skip
              console.log('Group conversation detected, skipping address fix.');
            }
          } catch (mErr) {
            console.warn('Could not load conversation members:', mErr);
          }
        }

        if (!peerAddress) {
          peerAddress = 'unknown';
          console.warn('No targetAddress or members, defaulting to unknown.');
        }

        description = `${myAddress}-${peerAddress}`;
        try {
          await conv.updateDescription(description);
          console.log(
            `Updated description for conversation ${getInboxId(conv)}: ${description}`
          );
        } catch (err) {
          console.error('Failed to set conversation description:', err);
          description = ''; 
        }
      }

      // Return the parsed peer address, or 'Unknown'
      return parseDescription(description, myAddress);
    },
    [getInboxId, parseDescription, targetAddress]
  );

  /**
   * Fetch messages for ONE conversation. Sort & deduplicate them, then store in messagesByConversation.
   */
  const fetchMessagesForConversation = useCallback(
    async (conv) => {
      if (!conv) return [];
      const inboxId = getInboxId(conv);
      try {
        const fetchedMessages = await conv.messages();
        fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

        // Deduplicate by message.id
        setMessagesByConversation((prev) => {
          const prevMsgs = prev[inboxId] || [];
          const existingIds = new Set(prevMsgs.map((m) => m.id));
          const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [inboxId]: [...prevMsgs, ...newUnique],
          };
        });

        return fetchedMessages;
      } catch (err) {
        console.error(`Error fetching messages for ${inboxId}:`, err);
        setError('Failed to fetch messages.');
        return [];
      }
    },
    [getInboxId]
  );

  /**
   * Map conversations to addresses using their descriptions, but only once initially (not on each poll).
   */
  const mapConversationsToAddresses = useCallback(
    async (convsMap, myAddress) => {
      const addressMap = { ...conversationAddresses };

      // For each conversation, ensure it has a valid description, parse it once
      const tasks = Array.from(convsMap.entries()).map(async ([inboxId, conv]) => {
        const peerAddress = await ensureDescription(conv, myAddress);
        addressMap[inboxId] = peerAddress || 'Unknown';
      });

      await Promise.all(tasks);
      setConversationAddresses(addressMap);
    },
    [conversationAddresses, ensureDescription]
  );

  /**
   * Fetch all conversations (once) and set up initial states
   */
  const fetchAllConversations = useCallback(
    async (myAddress) => {
      try {
        const allConversations = await xmtpClient.conversations.list();

        // Merge by inboxId
        const convsMap = new Map();
        allConversations.forEach((conv) => {
          const inboxId = getInboxId(conv);
          if (!convsMap.has(inboxId)) {
            convsMap.set(inboxId, conv);
          }
        });

        setConversationsMap(convsMap);

        // Ensure descriptions
        await mapConversationsToAddresses(convsMap, myAddress);

        // Initialize unread counts
        const initialUnread = {};
        convsMap.forEach((_, inboxId) => {
          initialUnread[inboxId] = 0;
        });
        setUnreadCounts(initialUnread);

        // Pre-fetch messages for each conversation, but do them in parallel
        await Promise.all(
          Array.from(convsMap.values()).map((conv) => fetchMessagesForConversation(conv))
        );

        // Select the first conversation by default (if none selected)
        if (convsMap.size > 0 && !selectedConversationId) {
          const firstInboxId = convsMap.keys().next().value;
          setSelectedConversationId(firstInboxId);
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError('Failed to fetch conversations.');
      }
    },
    [
      getInboxId,
      mapConversationsToAddresses,
      fetchMessagesForConversation,
      selectedConversationId,
      xmtpClient,
    ]
  );

  // --------------------------------------------------------------------------
  // Initialization effect
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient) return;
    let isMounted = true; // 14) For memory leak checks

    const init = async () => {
      try {
        await xmtpClient.conversations.syncAll();
        const myAddress = xmtpClient.accountAddress;
        if (!myAddress) {
          console.error("xmtpClient does not have an 'accountAddress' property.");
          if (isMounted) setError('User address not found.');
          return;
        }

        await fetchAllConversations(myAddress);
      } catch (err) {
        console.error('Error initializing conversations:', err);
        if (isMounted) {
          setError('Failed to initialize conversations.');
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [xmtpClient, fetchAllConversations]);

  // --------------------------------------------------------------------------
  // Polling effect to fetch new messages / new conversations
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient) return;
    let isMounted = true;

    const pollNewMessages = async () => {
      if (!isMounted) return;

      try {
        await xmtpClient.conversations.syncAll();
        const allConversations = await xmtpClient.conversations.list();

        // Merge by inboxId
        const newConvsMap = new Map();
        allConversations.forEach((conv) => {
          const inboxId = getInboxId(conv);
          if (!newConvsMap.has(inboxId)) {
            newConvsMap.set(inboxId, conv);
          }
        });

        // Update conversation map in one go
        setConversationsMap(newConvsMap);

        // We'll skip re-ensuring description here (to avoid repeated updates).
        // Instead, only parse known descriptions to get addresses (no forced update).
        const myAddress = xmtpClient.accountAddress;
        const newAddressMap = { ...conversationAddresses };
        for (let [inboxId, conv] of newConvsMap.entries()) {
          const desc = conv.description;
          const peer = parseDescription(desc, myAddress);
          if (!newAddressMap[inboxId]) {
            newAddressMap[inboxId] = peer;
          }
        }
        setConversationAddresses(newAddressMap);

        // Gather messages for all convs in parallel to avoid race conditions
        const results = await Promise.all(
          Array.from(newConvsMap.entries()).map(async ([inboxId, conv]) => {
            const fetchedMessages = await conv.messages();
            fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));
            return { inboxId, fetchedMessages };
          })
        );

        // Single state update for messages
        setMessagesByConversation((prev) => {
          const updated = { ...prev };
          // Track new message IDs for unread calculations
          const newlySeenIdsByConv = {};

          results.forEach(({ inboxId, fetchedMessages }) => {
            const existingMsgs = updated[inboxId] || [];
            const existingIds = new Set(existingMsgs.map((m) => m.id));

            // Filter new messages
            const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
            if (newUnique.length > 0) {
              updated[inboxId] = [...existingMsgs, ...newUnique];
            }
            newlySeenIdsByConv[inboxId] = newUnique.length;
          });

          // Update unread counts
          setUnreadCounts((prevCounts) => {
            const newCounts = { ...prevCounts };
            Object.entries(newlySeenIdsByConv).forEach(([inboxId, newCount]) => {
              // Only increment if it's NOT the selected convo
              if (inboxId !== selectedConversationId && newCount > 0) {
                newCounts[inboxId] = (newCounts[inboxId] || 0) + newCount;
              }
            });
            return newCounts;
          });

          return updated;
        });
      } catch (err) {
        console.error('Error during polling:', err);
        if (isMounted) setError('Error fetching new messages.');
      }
    };

    pollNewMessages();
    pollingIntervalRef.current = setInterval(pollNewMessages, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [
    xmtpClient,
    conversationAddresses,
    parseDescription,
    selectedConversationId,
    getInboxId,
  ]);

  // --------------------------------------------------------------------------
  // Effect to handle targetAddress changes
  // --------------------------------------------------------------------------
  useEffect(() => {
    
    if (!targetAddress || !xmtpClient) return;
    console.log('Target address changed to:', targetAddress);
    // If targetAddress is the same as before, do nothing
    if (
      prevTargetAddressRef.current &&
      targetAddress.toLowerCase() === prevTargetAddressRef.current.toLowerCase()
    ) {
      return;
    }
    // Update ref
    prevTargetAddressRef.current = targetAddress;

    // Initiate or select the DM
    const initiateChat = async () => {
      try {
        const myAddress = xmtpClient.accountAddress;
        if (!myAddress) {
          console.error("xmtpClient does not have an 'accountAddress' property.");
          setError('User address not found.');
          return;
        }

        // Check if there's an existing conversation with this target
        const existingEntry = Object.entries(conversationAddresses).find(
          ([, addr]) => addr.toLowerCase() === targetAddress.toLowerCase()
        );

        if (existingEntry) {
          const [inboxId] = existingEntry;
          const existingConv = conversationsMap.get(inboxId);
          if (existingConv) {
            setSelectedConversationId(inboxId);
            // Reset unread count
            setUnreadCounts((prev) => ({ ...prev, [inboxId]: 0 }));
            console.log('Already existing conversation:', inboxId);
            return; // We already have the messages in state
          }
        }

        // Otherwise, create new DM
        console.log('Creating conversation');
        const newConv = await xmtpClient.conversations.newDm(targetAddress);
        const inboxId = getInboxId(newConv);

        // Ensure conversation has a valid description once
        const description = `${myAddress}-${targetAddress}`;
        await newConv.updateDescription(description);
        console.log(`Set description for new conversation ${inboxId}: ${description}`);

        // Update local states in one go
        setConversationsMap((prev) => {
          const updated = new Map(prev);
          updated.set(inboxId, newConv);
          console.log('Updated conversationsMap:', updated);
          return updated;
        });
        setConversationAddresses((prev) => ({
          ...prev,
          [inboxId]: targetAddress,
        }));
        setUnreadCounts((prev) => ({ ...prev, [inboxId]: 0 }));
        setSelectedConversationId(inboxId);

        // Fetch messages for new conversation
        await fetchMessagesForConversation(newConv);
      } catch (err) {
        console.error('Error initiating chat:', err);
        setError('Failed to initiate chat.');
      }
    };

    initiateChat();
  }, [
    targetAddress,
    xmtpClient,
    conversationAddresses,
    conversationsMap,
    getInboxId,
    fetchMessagesForConversation,
  ]);

  // --------------------------------------------------------------------------
  // Send a new message to the current conversation
  // --------------------------------------------------------------------------
  const sendMessage = async () => {
    if (!selectedConversationId || !messageText.trim()) return;
    try {
      const conv = conversationsMap.get(selectedConversationId);
      if (!conv) {
        setError('Selected conversation not found.');
        return;
      }
      await conv.send(messageText.trim());
      setMessageText('');

      // Optionally fetch messages immediately after sending
      await fetchMessagesForConversation(conv);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  // --------------------------------------------------------------------------
  // Select an existing conversation
  // --------------------------------------------------------------------------
  const selectConversation = async (inboxId) => {
    if (!inboxId || !conversationsMap.has(inboxId)) {
      setError('Conversation not found.');
      return;
    }
    setSelectedConversationId(inboxId);

    // Reset unread count for the selected conversation
    setUnreadCounts((prevCounts) => ({
      ...prevCounts,
      [inboxId]: 0,
    }));
  };

  // --------------------------------------------------------------------------
  // Message rendering helpers
  // --------------------------------------------------------------------------
  const getDisplayContent = (msg) => {
    if (!msg) return '';
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    if (!codec) {
      // Not supported
      if (msg.fallback !== undefined) {
        return msg.fallback;
      }
      return '';
    }
    return msg.content;
  };

  const convertSentAtNsToDate = (sentAtNs) => {
    const asNumber = typeof sentAtNs === 'bigint' ? Number(sentAtNs) : sentAtNs;
    if (!asNumber || Number.isNaN(asNumber)) return undefined;
    return new Date(asNumber / 1e6); // ns -> ms
  };

  // --------------------------------------------------------------------------
  // Derived: Currently selected conversation
  // --------------------------------------------------------------------------
  const selectedConversation = selectedConversationId
    ? conversationsMap.get(selectedConversationId)
    : null;
  const messagesForSelected =
    messagesByConversation[selectedConversationId] || [];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  // Convert conversationsMap to an array for rendering:
  const conversationArray = Array.from(conversationsMap.entries());
  console.log('Render: conversationArray length is', conversationArray.length);

  return (
    <div className="chat-container">
      {/* ----------------------------------------------------------------------
        Side Panel: Conversations List
      ---------------------------------------------------------------------- */}
      <div className="conversations-list">
        <ListGroup>
          {conversationArray.map(([inboxId, conv]) => {
            const address = conversationAddresses[inboxId] || 'Unknown';
            const isActive = selectedConversationId === inboxId;
            const unread = unreadCounts[inboxId] || 0;

            return (
              <ListGroup.Item
                key={inboxId}
                action
                active={isActive}
                onClick={() => selectConversation(inboxId)}
                className="d-flex justify-content-between align-items-center"
              >
                {address}
                {unread > 0 && (
                  <Badge bg="primary" pill>
                    {unread}
                  </Badge>
                )}
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </div>

      {/* ----------------------------------------------------------------------
        Chat Window
      ---------------------------------------------------------------------- */}
      <div className="chat-window">
        {selectedConversation ? (
          <>
            <div className="chat-body">
              {error && (
                <Alert
                  variant="danger"
                  onClose={() => setError(null)}
                  dismissible
                  className="mb-2"
                >
                  {error}
                </Alert>
              )}

              {messagesForSelected.length === 0 ? (
                <p className="text-muted">No messages yet.</p>
              ) : (
                messagesForSelected.map((msg) => {
                  // 1. Check required properties
                  if (
                    !msg.id ||
                    !msg.senderInboxId ||
                    !msg.contentType ||
                    typeof msg.content === 'undefined' ||
                    !msg.sentAtNs
                  ) {
                    console.warn('Encountered a message with missing properties:', msg);
                    return null;
                  }

                  // 2. Convert timestamp
                  const sentDate = convertSentAtNsToDate(msg.sentAtNs);
                  const content = getDisplayContent(msg);
                  if (!content) {
                    return null; // e.g. read receipts
                  }

                  // 3. Check if message is from me
                  const myInboxId = xmtpClient.inboxId?.toLowerCase() || '';
                  const isMe = msg.senderInboxId.toLowerCase() === myInboxId;

                  return (
                    <div
                      className="message-row"
                      key={msg.id}
                      style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      <div
                        className={`message-bubble ${
                          isMe ? 'bubble-me' : 'bubble-them'
                        }`}
                      >
                        {content}
                        <div className="message-meta">
                          {sentDate ? sentDate.toLocaleString() : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ----------------------------------------------------------------
              Footer (Form to send messages)
            ---------------------------------------------------------------- */}
            <div className="chat-footer">
              <Form.Group controlId="messageText" className="mb-2">
                <Form.Control
                  type="text"
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  // 8) Replace onKeyPress with onKeyDown
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </Form.Group>
              <Button variant="primary" onClick={sendMessage}>
                Send
              </Button>
            </div>
          </>
        ) : (
          <div className="no-conversation-selected">
            <p>Select a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
