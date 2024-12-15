// src/App.js
import React, { useState, useEffect } from 'react';
import {
  ZeroAddress,
  BrowserProvider,
  Contract,
  parseUnits,
  formatUnits,
  toBigInt,
  isAddress as ethersIsAddress,
} from 'ethers';
import PalketInfo from './palketInfo.json';

import {
  Container,
  Navbar,
  Nav,
  Button,
  Form,
  Card,
  Row,
  Col,
  Alert,
  Spinner,
  Modal,
  Badge,
  Tabs,
  Tab,
} from 'react-bootstrap';

import 'bootstrap/dist/css/bootstrap.min.css';

import { HashRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';

import Linkify from 'react-linkify';

// Import XMTP dependencies
import { Client} from '@xmtp/browser-sdk';
import { toBytes } from "viem/utils";

// Setup parameter to toggle between Sepolia and local network
const networkEnv = 'dev'; // 'dev' for Sepolia test environment, 'production' for mainnet

let palketAddress = PalketInfo.palketaddress;
let usdcAddress = PalketInfo.usdcaddress;
let palketAbi = PalketInfo.palketabi;
let usdcAbi = PalketInfo.usdcabi;

// AddressLink Component
const AddressLink = ({ address }) => {
  if (!address || !ethersIsAddress(address)) {
    return <span className="text-muted">Unknown Address</span>;
  }

  return (
    <span>
      <Link to={`/user/${address}`}>
        {address.substring(0, 6)}...{address.substring(address.length - 4)}
      </Link>
      {' '}
    </span>
  );
};

// Function to render star rating
const renderStarRating = (score) => {
  const totalStars = 5;
  const filledStars = score;
  const stars = [];
  for (let i = 1; i <= totalStars; i++) {
    stars.push(
      <span key={i} style={{ color: '#FFD700', fontSize: '1.2em' }}>
        {i <= filledStars ? '★' : '☆'}
      </span>
    );
  }
  return <span>{stars}</span>;
};

// Define linkify options
const linkifyOptions = {
  target: '_blank',
  rel: 'noopener noreferrer',
  componentDecorator: (decoratedHref, decoratedText, key) => (
    <a href={decoratedHref} key={key} target="_blank" rel="noopener noreferrer">
      {decoratedText}
    </a>
  ),
};

// OfferCard Component
const OfferCard = ({
  offer,
  usdcDecimals,
  account,
  loading,
  acceptOffer,
  cancelOffer,
  finalizeOffer,
  forfeitOffer,
  hideActions = false,
  averageScore,
}) => {
  const canAcceptOffer = () => {
    if (offer.state !== 0) return false; // Only if Created
    if (offer.offerType === 0) {
      // ReceiverInitiated
      return offer.receiver.toLowerCase() !== account.toLowerCase();
    } else {
      // SenderInitiated
      return offer.sender.toLowerCase() !== account.toLowerCase();
    }
  };

  const canCancelOffer = () => {
    if (offer.state !== 0) return false; 
    if (offer.offerType === 0) {
      // ReceiverInitiated
      return offer.receiver.toLowerCase() === account.toLowerCase();
    } else {
      // SenderInitiated
      return offer.sender.toLowerCase() === account.toLowerCase();
    }
  };

  const canFinalizeOffer = () => {
    return offer.state === 1 && offer.receiver.toLowerCase() === account.toLowerCase();
  };

  const offerTypeText = offer.offerType === 0 ? 'PRODUCT REQUEST' : 'PRODUCT OFFER';
  const formattedCreationTime = new Date(offer.creationTime * 1000).toLocaleString();
  const formattedAcceptanceTime = offer.acceptanceTime
    ? new Date(offer.acceptanceTime * 1000).toLocaleString()
    : 'Not Accepted Yet';

  const isExpired = () => {
    if (offer.state !== 1) return false;
    const expirationTime = offer.acceptanceTime + 180 * 24 * 60 * 60; 
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= expirationTime;
  };

  return (
    <Col md={4}>
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <Card.Title>Offer {offer.offerId}</Card.Title>
            {offer.state === 2 && <Badge bg={"secondary"}>{renderStarRating(offer.senderScore)}</Badge>}
            {offer.state === 0 && offer.offerType === 0 && 
              <Badge bg={"primary"}> {offerTypeText} </Badge>
            }
            {offer.state === 0 && offer.offerType === 1 && 
              <Badge bg={"secondary"}> {offerTypeText} </Badge>
            }
            <Badge bg={getBadgeVariant(offer.state)}>{getOfferState(offer.state)}</Badge>
          </div>
          <Card.Text>
            <Linkify options={linkifyOptions}>{offer.productDescription}</Linkify>
          </Card.Text>
          <Card.Text>
            <strong>{parseFloat(formatUnits(offer.productValue, usdcDecimals)).toFixed(2)} USDC</strong>
          </Card.Text>
          <Card.Text>
            Receiver: <AddressLink address={offer.receiver} />
          </Card.Text>
          <Card.Text>
            Sender: <AddressLink address={offer.sender} />{' '}
            <span>(Avg Score: {averageScore})</span>
          </Card.Text>
          <Card.Text>Created: {formattedCreationTime}</Card.Text>
          {offer.state !== 0 && offer.state !== 3 && (
            <Card.Text>Accepted: {formattedAcceptanceTime}</Card.Text>
          )}

          {!hideActions && (
            <>
              {canAcceptOffer() && (
                <Button
                  variant="success"
                  onClick={() => acceptOffer(offer.offerId)}
                  disabled={loading}
                  className="mr-2 mt-2"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Accept Offer'}
                </Button>
              )}

              {canCancelOffer() && (
                <Button
                  variant="danger"
                  onClick={() => cancelOffer(offer.offerId)}
                  disabled={loading}
                  className="mr-2 mt-2"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Cancel Offer'}
                </Button>
              )}

              {canFinalizeOffer() && (
                <FinalizeOfferModal
                  offerId={offer.offerId}
                  finalizeOffer={finalizeOffer}
                  loading={loading}
                />
              )}

              {isExpired() && (
                <Button
                  variant="warning"
                  onClick={() => forfeitOffer(offer.offerId)}
                  disabled={loading}
                  className="mt-2"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Offer'}
                </Button>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Col>
  );
};

function getOfferState(state) {
  switch (state) {
    case 0:
      return 'Created';
    case 1:
      return 'Accepted';
    case 2:
      return 'Finalized';
    case 3:
      return 'Cancelled';
    case 4:
      return 'Forfeited';
    default:
      return 'Unknown';
  }
}

function getBadgeVariant(state) {
  switch (state) {
    case 0:
      return 'success';
    case 1:
      return 'info';
    case 2:
      return 'dark';
    case 3:
      return 'danger';
    case 4:
      return 'warning';
    default:
      return 'light';
  }
}

const FinalizeOfferModal = ({ offerId, finalizeOffer, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedScore, setSelectedScore] = useState(5);

  const handleFinalize = () => {
    finalizeOffer(offerId, selectedScore);
    setShowModal(false);
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="mr-2 mt-2"
      >
        {loading ? <Spinner animation="border" size="sm" /> : 'Finalize Offer'}
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Finalize Offer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="scoreSelect">
            <Form.Label>Select a Score for the Sender</Form.Label>
            <Form.Control
              as="select"
              value={selectedScore}
              onChange={(e) => setSelectedScore(Number(e.target.value))}
            >
              <option value={1}>One Star</option>
              <option value={2}>Two Stars</option>
              <option value={3}>Three Stars</option>
              <option value={4}>Four Stars</option>
              <option value={5}>Five Stars</option>
            </Form.Control>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleFinalize} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Finalize'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Chat Component
const Chat = ({ xmtpClient, account, recipientAddress }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [conversation, setConversation] = useState(null);

  useEffect(() => {
    if (!xmtpClient || !recipientAddress) return;
    let stream;
    const initConversation = async () => {
      try {
        const conversation = await xmtpClient.conversations.newConversation(recipientAddress);
        setConversation(conversation);

        const existingMessages = await conversation.messages();
        setMessages(existingMessages);

        // Listen for new messages
        stream = await conversation.streamMessages();
        for await (const message of stream) {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    };

    initConversation();

    return () => {
      if (stream) {
        stream.return();
      }
    };
  }, [xmtpClient, recipientAddress]);

  const sendMessage = async () => {
    if (!conversation || !messageText) return;
    try {
      await conversation.send(messageText);
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <Container className="mt-4">
      <h2>Chat with {recipientAddress}</h2>
      <div className="chat-messages" style={{ height: '400px', overflowY: 'scroll' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <strong>{msg.senderAddress === account ? 'You' : 'Them'}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <Form.Group controlId="messageText">
        <Form.Control
          type="text"
          placeholder="Type your message"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        />
      </Form.Group>
      <Button variant="primary" onClick={sendMessage}>
        Send
      </Button>
    </Container>
  );
};

const Home = () => {
  return null; 
};

const getOfferStateValue = (stateName) => {
  switch (stateName) {
    case 'Created':
      return 0;
    case 'Accepted':
      return 1;
    case 'Finalized':
      return 2;
    case 'Cancelled':
      return 3;
    case 'Forfeited':
      return 4;
    default:
      return null;
  }
};

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [marketplaceContract, setMarketplaceContract] = useState(null);
  const [usdcContract, setUsdcContract] = useState(null);
  const [usdcDecimals, setUsdcDecimals] = useState(null);
  const [account, setAccount] = useState('');
  const [allOffers, setAllOffers] = useState([]);
  const [formValues, setFormValues] = useState({
    productDescription: '',
    productValue: '',
    offerType: 'ReceiverInitiated',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [userDescription, setUserDescription] = useState('');
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  const [usdcBalance, setUsdcBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState('');
  const [mintRecipient] = useState('');
  const [mintLoading, setMintLoading] = useState(false);

  const [filterType, setFilterType] = useState('All');
  const [filterState, setFilterState] = useState('All');

  const [xmtpClient, setXmtpClient] = useState(null);
  
  // New states for encryption key modal
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [encryptionKeyInput, setEncryptionKeyInput] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [awaitingChatAddress, setAwaitingChatAddress] = useState(null);

  useEffect(() => {
    connectWallet();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (marketplaceContract && account) {
      loadOffers(marketplaceContract);
      loadUserDescription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplaceContract, account]);

  useEffect(() => {
    loadUsdcBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdcContract, account, usdcDecimals]);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      console.log('Please connect to MetaMask.');
      setAccount('');
      setUsdcBalance(null);
    } else {
      await connectWallet();
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    try {
      setLoading(true);

      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const tempProvider = new BrowserProvider(window.ethereum);
      const tempSigner = await tempProvider.getSigner();
      const tempAccount = await tempSigner.getAddress();

      const tempMarketplaceContract = new Contract(
        palketAddress,
        palketAbi,
        tempSigner
      );
      const tempUsdcContract = new Contract(usdcAddress, usdcAbi, tempSigner);
      const tempUsdcDecimals = await tempUsdcContract.decimals();

      setProvider(tempProvider);
      setSigner(tempSigner);
      setAccount(tempAccount);
      setMarketplaceContract(tempMarketplaceContract);
      setUsdcContract(tempUsdcContract);
      setUsdcDecimals(tempUsdcDecimals);

      await loadOffers(tempMarketplaceContract);
      await loadUserDescription(); 
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsdcBalance = async () => {
    try {
      if (usdcContract && account && usdcDecimals !== null) {
        const balance = await usdcContract.balanceOf(account);
        const formattedBalance = parseFloat(formatUnits(balance, usdcDecimals)).toFixed(2);
        setUsdcBalance(formattedBalance);
      }
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching USDC balance: ' + (error.reason || error.message),
      });
    }
  };

  const loadOffers = async (contract) => {
    try {
      setLoading(true);
      const tempAllOffers = [];
      const offerCount = await contract.offerCount();

      const userStats = {};

      for (let offerId = 1; offerId <= offerCount; offerId++) {
        const offer = await contract.offers(offerId);
        const offerObj = {
          offerId: Number(offer.offerId),
          receiver: offer.receiver,
          sender: offer.sender,
          productDescription: offer.productDescription,
          productValue: offer.productValue,
          deposit: offer.deposit,
          state: Number(offer.state),
          offerType: Number(offer.offerType),
          creationTime: Number(offer.creationTime),
          acceptanceTime: Number(offer.acceptanceTime),
          senderScore: Number(offer.senderScore),
        };
        tempAllOffers.push(offerObj);
      }

      for (let offer of tempAllOffers) {
        const senderAddress = offer.sender.toLowerCase();
        if (senderAddress !== ZeroAddress.toLowerCase()) {
          if (!userStats[senderAddress]) {
            const profile = await contract.userProfiles(senderAddress);
            const totalScore = Number(profile.totalScoreAsSender);
            const numFinalized = Number(profile.numOffersFinalizedAsSender);
            const averageScore = numFinalized > 0 ? parseFloat(totalScore / numFinalized).toFixed(2) : 'N/A';
            userStats[senderAddress] = {
              averageScore: averageScore,
            };
          }
        }
      }

      const enrichedAllOffers = tempAllOffers.map((offer) => {
        const senderAddress = offer.sender.toLowerCase();
        return {
          ...offer,
          averageScore: userStats[senderAddress]?.averageScore || 'N/A',
        };
      });

      setAllOffers(enrichedAllOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading offers: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserDescription = async () => {
    try {
      if (!marketplaceContract || !account) return;
      const profile = await marketplaceContract.userProfiles(account);
      setUserDescription(profile.descriptionAsSender);
    } catch (error) {
      console.error('Error loading description:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading description: ' + (error.reason || error.message),
      });
    }
  };

  const handleInputChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  };

  const createOffer = async () => {
    try {
      setLoading(true);
      const { productDescription, productValue, offerType } = formValues;

      if (!productDescription || !productValue) {
        setMessage({ type: 'danger', text: 'Please fill in all fields.' });
        setLoading(false);
        return;
      }

      const productValueString = productValue.toString();
      const valueInWei = parseUnits(productValueString, usdcDecimals);
      const valueInBigInt = toBigInt(valueInWei);
      const deposit = (valueInBigInt * 5n) / 10n; 
      const totalAmount = valueInBigInt + deposit; 

      if (offerType === 'ReceiverInitiated') {
        const approveTx = await usdcContract.approve(palketAddress, totalAmount);
        await approveTx.wait();
        const tx = await marketplaceContract.createOfferByReceiver(
          productDescription,
          productValueString
        );
        await tx.wait();
      } else {
        const approveTx = await usdcContract.approve(palketAddress, deposit);
        await approveTx.wait();
        const tx = await marketplaceContract.createOfferBySender(
          productDescription,
          productValueString
        );
        await tx.wait();
      }

      setMessage({ type: 'success', text: 'Offer created successfully!' });
      setFormValues({ productDescription: '', productValue: '', offerType: 'ReceiverInitiated' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error creating offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error creating offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptOffer = async (offerId) => {
    try {
      setLoading(true);
      const offer = await marketplaceContract.offers(offerId);
      const deposit = offer.deposit;
      const productValue = offer.productValue;
      const totalAmount = productValue + deposit;

      if (offer.offerType === 0) {
        const approveTx = await usdcContract.approve(palketAddress, deposit);
        await approveTx.wait();
      } else {
        const approveTx = await usdcContract.approve(palketAddress, totalAmount);
        await approveTx.wait();
      }

      const tx = await marketplaceContract.acceptOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer accepted successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error accepting offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error accepting offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.cancelOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer cancelled successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error cancelling offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error cancelling offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const finalizeOffer = async (offerId, score) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.finalizeOffer(offerId, score);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer finalized successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error finalizing offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error finalizing offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const forfeitOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.forfeitOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: `Offer ${offerId} forfeited successfully!` });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
    } catch (error) {
      console.error(`Error forfeiting offer ${offerId}:`, error);
      setMessage({
        type: 'danger',
        text: `Error forfeiting offer ${offerId}: ` + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForfeitExpiredOffers = async () => {
    try {
      setLoading(true);
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredOffers = allOffers.filter(
        (offer) =>
          offer.state === 1 &&
          offer.acceptanceTime + 180 * 24 * 60 * 60 <= currentTime
      );

      if (expiredOffers.length === 0) {
        setMessage({ type: 'info', text: 'No expired offers to forfeit.' });
        return;
      }

      for (let offer of expiredOffers) {
        await forfeitOffer(offer.offerId);
      }
    } catch (error) {
      console.error('Error forfeiting expired offers:', error);
      setMessage({
        type: 'danger',
        text: 'Error forfeiting expired offers: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserDescription = async () => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.setUserDescription(userDescription);
      await tx.wait();
      setMessage({ type: 'success', text: 'Description updated successfully!' });
      setShowDescriptionModal(false);
      await loadUserDescription();
    } catch (error) {
      console.error('Error updating description:', error);
      setMessage({
        type: 'danger',
        text: 'Error updating description: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to initialize XMTP after we have an encryption key
  const initializeXmtp = async (encryptionKey) => {
    try {
      if (!signer) {
        throw new Error("Wallet not connected, cannot initialize XMTP.");
      }
      const encryptionBytes = toBytes('0x' + encryptionKey);
      const client = await Client.create(signer, encryptionBytes,{
        env: networkEnv === 'dev' ? 'dev' : 'production',
      });
      setXmtpClient(client);
      setShowEncryptionModal(false);
    } catch (error) {
      console.error('Error initializing XMTP client:', error);
      alert(`XMTP initialization failed: ${error.message}`);
    }
  };

  // Generate a random hex key for encryption
  const generateRandomKey = async () => {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    // Convert to hex
    const hexKey = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
    setGeneratedKey(hexKey);
  };

  const handleChatInitialization = (address) => {
    // If xmtpClient is already initialized, just continue
    if (xmtpClient) {
      setAwaitingChatAddress(address);
      return;
    }
    // If not initialized, show modal
    setAwaitingChatAddress(address);
    setShowEncryptionModal(true);
  };

  // UserInfo Component
  const UserInfo = ({
    marketplaceContract,
    usdcDecimals,
    account,
    setShowDescriptionModal,
    xmtpClient,
    onInitiateChat
  }) => {
    const { address } = useParams();
    const [userProfile, setUserProfile] = useState(null);
    const [userOffersAsSender, setUserOffersAsSender] = useState([]);
    const [userOffersAsReceiver, setUserOffersAsReceiver] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
      if (marketplaceContract && address) {
        fetchUserInfo();
        fetchUserOffers();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketplaceContract, address]);

    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const profile = await marketplaceContract.userProfiles(address);
        const totalScore = Number(profile.totalScoreAsSender);
        const numFinalizedAsSender = Number(profile.numOffersFinalizedAsSender);
        const averageScoreAsSender =
          numFinalizedAsSender > 0 ? parseFloat(totalScore / numFinalizedAsSender).toFixed(2) : 'N/A';

        setUserProfile({
          descriptionAsSender: profile.descriptionAsSender,
          averageScoreAsSender: averageScoreAsSender,
          numOffersAcceptedAsSender: Number(profile.numOffersAcceptedAsSender),
          numOffersFinalizedAsSender: numFinalizedAsSender,
          numOffersAcceptedAsReceiver: Number(profile.numOffersAcceptedAsReceiver),
          numOffersFinalizedAsReceiver: Number(profile.numOffersFinalizedAsReceiver),
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
        setMessage({
          type: 'danger',
          text: 'Error fetching user information: ' + (error.reason || error.message),
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchUserOffers = async () => {
      try {
        setLoading(true);
        const offerCount = await marketplaceContract.offerCount();
        const tempUserOffersAsSender = [];
        const tempUserOffersAsReceiver = [];

        for (let offerId = 1; offerId <= offerCount; offerId++) {
          const offer = await marketplaceContract.offers(offerId);
          const offerSender = offer.sender.toLowerCase();
          const offerReceiver = offer.receiver.toLowerCase();
          const userAddress = address.toLowerCase();

          const offerObj = {
            offerId: Number(offer.offerId),
            receiver: offer.receiver,
            sender: offer.sender,
            productDescription: offer.productDescription,
            productValue: offer.productValue,
            deposit: offer.deposit,
            state: Number(offer.state),
            offerType: Number(offer.offerType),
            creationTime: Number(offer.creationTime),
            acceptanceTime: Number(offer.acceptanceTime),
            senderScore: Number(offer.senderScore),
          };

          if (offerSender === userAddress) {
            tempUserOffersAsSender.push(offerObj);
          }
          if (offerReceiver === userAddress) {
            tempUserOffersAsReceiver.push(offerObj);
          }
        }

        setUserOffersAsSender(tempUserOffersAsSender);
        setUserOffersAsReceiver(tempUserOffersAsReceiver);
      } catch (error) {
        console.error('Error fetching user offers:', error);
        setMessage({
          type: 'danger',
          text: 'Error fetching user offers: ' + (error.reason || error.message),
        });
      } finally {
        setLoading(false);
      }
    };

    if (!marketplaceContract) {
      return (
        <Container className="mt-4">
          <Alert variant="warning">Marketplace contract is not loaded.</Alert>
        </Container>
      );
    }

    return (
      <Container className="mt-4">
        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
            {message.text}
          </Alert>
        )}

        {loading ? (
          <div className="text-center">
            <Spinner animation="border" />
          </div>
        ) : userProfile ? (
          <>
            <Card className="mb-4">
              <Card.Header>
                <h3>
                  User Profile <Badge bg="secondary">{address}</Badge>
                </h3>
              </Card.Header>
              <Card.Body>
                <Tabs defaultActiveKey="sender" id="user-offers-tabs" className="mb-3">
                  <Tab eventKey="sender" title="Sender Profile">
                    <Card className="mb-4">
                      <Card.Body>
                        <Card.Text>
                          <strong>Description:</strong> {userProfile.descriptionAsSender || 'No description provided.'}
                        </Card.Text>
                        <Card.Text>
                          <strong>Average Score:</strong>{' '}
                          {userProfile.averageScoreAsSender !== 'N/A' ? (
                            <>
                              {renderStarRating(parseFloat(userProfile.averageScoreAsSender))} ({userProfile.averageScoreAsSender})
                            </>
                          ) : (
                            'N/A'
                          )}
                        </Card.Text>
                        <Card.Text>
                          <strong>Offers Accepted:</strong> {userProfile.numOffersAcceptedAsSender}
                        </Card.Text>
                        <Card.Text>
                          <strong>Offers Finalized:</strong> {userProfile.numOffersFinalizedAsSender}
                        </Card.Text>
                        {address.toLowerCase() === account.toLowerCase() && (
                          <Button
                            variant="primary"
                            onClick={() => setShowDescriptionModal(true)}
                            className="mt-3"
                          >
                            Set Description
                          </Button>
                        )}
                      </Card.Body>
                    </Card>

                    {userOffersAsSender.length > 0 ? (
                      <Row className="g-4">
                        {userOffersAsSender.map((offer, index) => (
                          <Col key={index}>
                            <OfferCard
                              offer={offer}
                              usdcDecimals={usdcDecimals}
                              account={account}
                              loading={loading}
                              acceptOffer={null} 
                              cancelOffer={null} 
                              finalizeOffer={null} 
                              forfeitOffer={null} 
                              hideActions
                              averageScore={offer.averageScore}
                            />
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <p className="text-muted">No offers found where this user is the sender.</p>
                    )}
                  </Tab>
                  <Tab eventKey="receiver" title="Receiver Profile">
                    <Card className="mb-4">
                      <Card.Body>
                        <Card.Text>
                          <strong>Offers Accepted:</strong> {userProfile.numOffersAcceptedAsReceiver}
                        </Card.Text>
                        <Card.Text>
                          <strong>Offers Finalized:</strong> {userProfile.numOffersFinalizedAsReceiver}
                        </Card.Text>
                      </Card.Body>
                    </Card>

                    {userOffersAsReceiver.length > 0 ? (
                      <Row className="g-4">
                        {userOffersAsReceiver.map((offer, index) => (
                          <Col key={index}>
                            <OfferCard
                              offer={offer}
                              usdcDecimals={usdcDecimals}
                              account={account}
                              loading={loading}
                              acceptOffer={null}
                              cancelOffer={null}
                              finalizeOffer={null}
                              forfeitOffer={null}
                              hideActions
                              averageScore={offer.averageScore}
                            />
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <p className="text-muted">No offers found where this user is the receiver.</p>
                    )}
                  </Tab>
                </Tabs>

                <Card className="mb-4">
                  <Card.Header>
                    <h4>Chat with {address}</h4>
                  </Card.Header>
                  <Card.Body>
                    {!xmtpClient ? (
                      <Button variant="primary" onClick={() => onInitiateChat(address)}>
                        Start Chat
                      </Button>
                    ) : (
                      <Chat xmtpClient={xmtpClient} account={account} recipientAddress={address} />
                    )}
                  </Card.Body>
                </Card>
              </Card.Body>
            </Card>
          </>
        ) : (
          <p className="text-muted">No profile information available.</p>
        )}
      </Container>
    );
  };

  return (
    <Router>
      <div>
        {networkEnv === 'dev' && (
          <Alert variant="info" className="text-center mb-0">
            <strong>Test Mode:</strong> Connected to Local Network
          </Alert>
        )}

        <Navbar bg="dark" variant="dark">
          <Container>
            <Navbar.Brand as={Link} to="/">
              Palket: The Pal-to-Pal market
            </Navbar.Brand>
            <Nav className="ml-auto">
              <Nav.Link href="#">
                {account
                  ? `Account: ${account.substring(0, 6)}...${account.substring(account.length - 4)}`
                  : 'Not connected'}
              </Nav.Link>
              {usdcBalance !== null && (
                <Nav.Link href="#">
                  USDC Balance: {usdcBalance} USDC
                </Nav.Link>
              )}
              <Button
                variant="outline-light"
                as={Link}
                to={account ? `/user/${account}` : '#'}
                className="ml-2"
                disabled={!account}
              >
                My Profile
              </Button>
              <Button variant="outline-light" onClick={connectWallet} className="ml-2">
                {account ? 'Change Account' : 'Connect Wallet'}
              </Button>
            </Nav>
          </Container>
        </Navbar>

        <Container className="mt-4">
          {message && (
            <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
              {message.text}
            </Alert>
          )}

          {networkEnv === 'dev' && (
            <Card className="mb-4">
              <Card.Body>
                <Card.Title>Mint Mock USDC</Card.Title>
                <Form>
                  <Form.Group controlId="mintAmount">
                    <Form.Label>Amount to Mint (USDC)</Form.Label>
                    <Form.Control
                      type="number"
                      placeholder="Enter amount"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </Form.Group>

                  <Button variant="success" type="submit" disabled={mintLoading} onClick={(e) => {
                    e.preventDefault();
                    // In dev mode, assume mint not needed or can be implemented similarly
                    alert('Implement mint logic here if needed.');
                  }}>
                    {mintLoading ? <Spinner animation="border" size="sm" /> : 'Mint USDC'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          )}

          <h2>Create Offer</h2>
          <Form>
            <Form.Group controlId="offerType">
              <Form.Label>Offer Type</Form.Label>
              <Form.Control
                as="select"
                name="offerType"
                value={formValues.offerType}
                onChange={handleInputChange}
              >
                <option value="ReceiverInitiated">Create as Receiver</option>
                <option value="SenderInitiated">Create as Sender</option>
              </Form.Control>
            </Form.Group>

            <Form.Group controlId="productDescription">
              <Form.Label>Product Description</Form.Label>
              <Form.Control
                type="text"
                name="productDescription"
                placeholder="Product Description"
                value={formValues.productDescription}
                onChange={handleInputChange}
              />
            </Form.Group>

            <Form.Group controlId="productValue">
              <Form.Label>Product Value (USDC)</Form.Label>
              <Form.Control
                type="number"
                name="productValue"
                placeholder="Product Value (USDC)"
                value={formValues.productValue}
                onChange={handleInputChange}
                min="0"
                step="0.01"
              />
            </Form.Group>

            <Button variant="primary" onClick={createOffer} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Create Offer'}
            </Button>
          </Form>

          <h2 className="mt-5">All Offers</h2>

          <Form className="mb-4">
            <Row>
              <Col md={6}>
                <Form.Group controlId="filterType">
                  <Form.Label>Filter by Offer Type</Form.Label>
                  <Form.Control
                    as="select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="ReceiverInitiated">Receiver Initiated</option>
                    <option value="SenderInitiated">Sender Initiated</option>
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="filterState">
                  <Form.Label>Filter by Offer State</Form.Label>
                  <Form.Control
                    as="select"
                    value={filterState}
                    onChange={(e) => setFilterState(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Created">Created</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Finalized">Finalized</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Forfeited">Forfeited</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
          </Form>

          {allOffers.length > 0 ? (
            <Row>
              {allOffers
                .filter((offer) => {
                  if (filterType !== 'All') {
                    const desiredType = filterType === 'ReceiverInitiated' ? 0 : 1; 
                    if (offer.offerType !== desiredType) return false;
                  }

                  if (filterState !== 'All') {
                    const desiredState = getOfferStateValue(filterState);
                    if (offer.state !== desiredState) return false;
                  }

                  return true;
                })
                .map((offer, index) => (
                  <OfferCard
                    key={index}
                    offer={offer}
                    usdcDecimals={usdcDecimals}
                    account={account}
                    loading={loading}
                    acceptOffer={acceptOffer}
                    cancelOffer={cancelOffer}
                    finalizeOffer={finalizeOffer}
                    forfeitOffer={forfeitOffer}
                    averageScore={offer.averageScore}
                  />
                ))}
            </Row>
          ) : (
            <p>No offers available.</p>
          )}

          <Button
            variant="warning"
            onClick={handleForfeitExpiredOffers}
            disabled={loading}
            className="mt-3"
          >
            {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Expired Offers'}
          </Button>
        </Container>

        <Modal show={showDescriptionModal} onHide={() => setShowDescriptionModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Set Your Description</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group controlId="userDescription">
              <Form.Label>Description as Sender</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your description"
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDescriptionModal(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={updateUserDescription} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Save'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Encryption Key Modal for XMTP */}
        <Modal show={showEncryptionModal} onHide={() => setShowEncryptionModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Initialize Chat</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {!generatedKey ? (
              <>
                <p>Do you have an existing encryption key?</p>
                <Form.Label>Enter your encryption key (if you have one):</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Existing encryption key (hex)"
                  value={encryptionKeyInput}
                  onChange={(e) => setEncryptionKeyInput(e.target.value)}
                />
                <div className="mt-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!encryptionKeyInput) {
                        alert('Please enter a key or choose to create a new one.');
                        return;
                      }
                      initializeXmtp(encryptionKeyInput);
                    }}
                  >
                    Use Existing Key
                  </Button>{' '}
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await generateRandomKey();
                    }}
                  >
                    Create New Key
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Alert variant="info">
                  <strong>Your new encryption key:</strong><br/>
                  {generatedKey}
                </Alert>
                <p>Please store this key in a safe place. If you lose it, you cannot recover your previous conversations.</p>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!generatedKey) {
                      alert('Key not generated.');
                      return;
                    }
                    initializeXmtp(generatedKey);
                  }}
                >
                  Proceed with this new key
                </Button>
              </>
            )}
          </Modal.Body>
        </Modal>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/user/:address"
            element={
              <UserInfo
                marketplaceContract={marketplaceContract}
                usdcDecimals={usdcDecimals}
                account={account}
                setShowDescriptionModal={setShowDescriptionModal}
                xmtpClient={xmtpClient}
                onInitiateChat={handleChatInitialization}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
