// src/App.jsx
import React, { useState, useEffect } from 'react';
import {
  ZeroAddress,
  BrowserProvider,
  Contract,
  parseUnits,
  formatUnits,
  toBigInt as ethersToBigInt, // Renamed to avoid conflict
  isAddress as ethersIsAddress,
  keccak256,
  getBytes,
} from 'ethers';
import PalketInfo from './palketInfo.json';

import {
  Container,
  Navbar,
  Nav,
  NavDropdown,
  Button,
  Form,
  Row,
  Col,
  Alert,
  Spinner,
  Modal,
  Badge,
  Dropdown,
  DropdownButton,
  Tab,
  Tabs,
} from 'react-bootstrap';

import 'bootstrap/dist/css/bootstrap.min.css';

import palketLogo from './assets/palket.png';

import Linkify from 'react-linkify';

import { Client, ConsentEntityType, ConsentState } from '@xmtp/browser-sdk';

import { toBytes } from 'viem/utils';

import Chat from './Chat';

import Wiki from './Wiki';

// Removed React Router usage to simplify

const xmtpEnv = 'production';

/** =====================
 *    Helper Components
 ======================*/

// AddressLink
const AddressLink = ({ address, onChat, onSelectMenu, onSetProfileAddress }) => {
  if (!address || !ethersIsAddress(address)) {
    return <span className="text-muted">Unknown Address</span>;
  }

  return (
    <span>
      <span
        style={{ cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline' }}
        onClick={() => {
          // Switch to Profile tab
          onSelectMenu('Profile');
          // Load that user’s address in the Profile view
          onSetProfileAddress(address);
        }}
      >
        {address.substring(0, 6)}...{address.substring(address.length - 4)}
      </span>
      <Button
        variant="link"
        size="sm"
        onClick={() => {
          // Switch to Chat tab
          onSelectMenu('Chat');
          // Load that user’s chat
          onChat(address);
        }}
      >
        Chat
      </Button>
    </span>
  );
};

// Star rating
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

// Linkify options
const linkifyOptions = {
  target: '_blank',
  rel: 'noopener noreferrer',
  componentDecorator: (decoratedHref, decoratedText, key) => (
    <a href={decoratedHref} key={key} target="_blank" rel="noopener noreferrer">
      {decoratedText}
    </a>
  ),
};

// Modal: ChooseParticipant
const ChooseParticipantModal = ({
  show,
  onHide,
  participants,
  chooseParticipant,
  loading,
}) => {
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const handleChoose = () => {
    if (selectedParticipant) {
      chooseParticipant(selectedParticipant);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Choose Participant</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {participants.length === 0 ? (
          <p>No participants found.</p>
        ) : (
          <Form.Group controlId="participantSelect">
            <Form.Label>Select Participant</Form.Label>
            <Form.Control
              as="select"
              onChange={(e) => setSelectedParticipant(e.target.value)}
            >
              <option value={''}>-- Select --</option>
              {participants.map((p, idx) => (
                <option key={idx} value={p.applicant}>
                  {p.applicant.substring(0, 6)}...{p.applicant.substring(p.applicant.length - 4)} |{' '}
                  {p.bidPrice > 0 ? ` Bid: ${p.bidPrice} USDC` : ''}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <Button variant="primary" onClick={handleChoose} disabled={!selectedParticipant || loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Choose'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Modal: FinalizeOffer
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

// Helper functions: offer state
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
      return 'success'; // Created
    case 1:
      return 'info'; // Accepted
    case 2:
      return 'dark'; // Finalized
    case 3:
      return 'danger'; // Cancelled
    case 4:
      return 'warning'; // Forfeited
    default:
      return 'light'; // Unknown
  }
}

// Modal: RequestParticipation
const RequestParticipationModal = ({
  show,
  onHide,
  loading,
  requestParticipation,
  offerType,
}) => {
  const [bidValue, setBidValue] = useState('');

  const handleRequest = () => {
    requestParticipation(bidValue);
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Request Participation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {offerType === 0 ? (
          <Form.Group controlId="bidValue">
            <Form.Label>Your Bid Price (USDC)</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter your proposed price"
              min="0.01"
              step="0.01"
              value={bidValue}
              onChange={(e) => setBidValue(e.target.value)}
            />
          </Form.Group>
        ) : (
          <p>Click "Request" to participate. No bid needed for Sender-Initiated offers.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={handleRequest}
          disabled={
            loading ||
            (offerType === 0 && (!bidValue || parseFloat(bidValue) <= 0))
          }
        >
          {loading ? <Spinner animation="border" size="sm" /> : 'Request'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Modal: ConfirmTransaction
const ConfirmTransactionModal = ({
  show,
  onHide,
  amount,
  onConfirm,
  loading,
}) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Confirm Transaction</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          You are about to transfer <strong>{amount}</strong> USDC. Are you sure
          you want to proceed?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Confirm'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// OfferCard
const OfferCard = ({
  offer,
  usdcDecimals,
  account,
  loading,
  cancelOffer,
  finalizeOffer,
  forfeitOffer,
  hideActions = false,
  averageScore,
  requestParticipationForOffer,
  canChooseParticipantForOffer,
  isExpired,
  onChat,
  onSelectMenu,
  onSetProfileAddress,
}) => {
  const offerTypeText = offer.offerType === 0 ? 'PRODUCT REQUEST' : 'PRODUCT OFFER';
  const formattedCreationTime = new Date(offer.creationTime * 1000).toLocaleString();
  const formattedAcceptanceTime = offer.acceptanceTime
    ? new Date(offer.acceptanceTime * 1000).toLocaleString()
    : 'Not Accepted Yet';

  const canCancelOffer = () => {
    if (offer.state !== 0) return false;
    if (offer.offerType === 0) {
      return offer.receiver.toLowerCase() === account.toLowerCase();
    } else {
      return offer.sender.toLowerCase() === account.toLowerCase();
    }
  };

  return (
    <div className="mb-4 p-3 border rounded" style={{ backgroundColor: '#f9f9f9' }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Offer {offer.offerId}</h5>
        <div>
          {offer.state === 2 && (
            <Badge bg="secondary">{renderStarRating(offer.senderScore)}</Badge>
          )}
          {offer.state === 0 && offer.offerType === 0 && (
            <Badge bg="primary" className="ms-2">{offerTypeText}</Badge>
          )}
          {offer.state === 0 && offer.offerType === 1 && (
            <Badge bg="secondary" className="ms-2">{offerTypeText}</Badge>
          )}
          <Badge bg={getBadgeVariant(offer.state)} className="ms-2">
            {getOfferState(offer.state)}
          </Badge>
        </div>
      </div>
      <div>
        <Linkify options={linkifyOptions}>{offer.productDescription}</Linkify>
      </div>
      {offer.offerType === 1 && (
        <div className="mt-2">
          <strong>
            {parseFloat(formatUnits(offer.productValue, usdcDecimals)).toFixed(2)} USDC
          </strong>
        </div>
      )}
      <div className="mt-2">
        <strong>Receiver:</strong>{' '}
        <AddressLink
          address={offer.receiver}
          onChat={onChat}
          onSelectMenu={onSelectMenu}
          onSetProfileAddress={onSetProfileAddress}
        />
      </div>
      <div>
        <strong>Sender:</strong>{' '}
        <AddressLink
          address={offer.sender}
          onChat={onChat}
          onSelectMenu={onSelectMenu}
          onSetProfileAddress={onSetProfileAddress}
        />{' '}
        <span>(Avg Score: {averageScore})</span>
      </div>
      <div>
        <strong>Created:</strong> {formattedCreationTime}
      </div>
      {offer.state !== 0 && offer.state !== 3 && (
        <div>
          <strong>Accepted:</strong> {formattedAcceptanceTime}
        </div>
      )}

      {!hideActions && (
        <div className="mt-3">
          {offer.state === 0 &&
            ((offer.offerType === 0 &&
              offer.receiver.toLowerCase() !== account.toLowerCase()) ||
              (offer.offerType === 1 &&
                offer.sender.toLowerCase() !== account.toLowerCase())) && (
              <Button
                variant="success"
                onClick={() => requestParticipationForOffer(offer)}
                disabled={loading}
                className="me-2"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Request Participation'}
              </Button>
            )}

          {offer.state === 0 &&
            ((offer.offerType === 0 &&
              offer.receiver.toLowerCase() === account.toLowerCase()) ||
              (offer.offerType === 1 &&
                offer.sender.toLowerCase() === account.toLowerCase())) && (
              <Button
                variant="primary"
                onClick={() => canChooseParticipantForOffer(offer)}
                disabled={loading}
                className="me-2"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Choose Participant'}
              </Button>
            )}

          {canCancelOffer() && (
            <Button
              variant="danger"
              onClick={() => cancelOffer(offer.offerId)}
              disabled={loading}
              className="me-2"
            >
              {loading ? <Spinner animation="border" size="sm" /> : 'Cancel Offer'}
            </Button>
          )}

          {offer.state === 1 &&
            offer.receiver.toLowerCase() === account.toLowerCase() && (
              <FinalizeOfferModal
                offerId={offer.offerId}
                finalizeOffer={finalizeOffer}
                loading={loading}
              />
            )}

          {isExpired && (
            <Button
              variant="warning"
              onClick={() => forfeitOffer(offer.offerId)}
              disabled={loading}
              className="mt-2"
            >
              {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Offer'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// UserProfile (New)
const UserProfile = ({
  marketplaceContract,
  usdcDecimals,
  account,
  userAddress,
  setShowDescriptionModal,
  onChat,
  onSelectMenu,
  onSetProfileAddress,
}) => {
  const [userProfile, setUserProfile] = useState(null);
  const [userOffersAsSender, setUserOffersAsSender] = useState([]);
  const [userOffersAsReceiver, setUserOffersAsReceiver] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (marketplaceContract && userAddress) {
      fetchUserInfo();
      fetchUserOffers();
    }
  }, [marketplaceContract, userAddress]);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const profile = await marketplaceContract.userProfiles(userAddress);
      const totalScore = Number(profile.totalScoreAsSender);
      const numFinalizedAsSender = Number(profile.numOffersFinalizedAsSender);
      const averageScoreAsSender =
        numFinalizedAsSender > 0
          ? parseFloat(totalScore / numFinalizedAsSender).toFixed(2)
          : 'N/A';

      setUserProfile({
        descriptionAsSender: profile.descriptionAsSender,
        averageScoreAsSender: averageScoreAsSender,
        numOffersAcceptedAsSender: Number(profile.numOffersAcceptedAsSender),
        numOffersFinalizedAsSender: numFinalizedAsSender,
        numOffersAcceptedAsReceiver: Number(profile.numOffersAcceptedAsReceiver),
        numOffersFinalizedAsReceiver: Number(
          profile.numOffersFinalizedAsReceiver
        ),
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
        const userAddressLower = userAddress.toLowerCase();

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

        if (offerSender === userAddressLower) {
          tempUserOffersAsSender.push(offerObj);
        }
        if (offerReceiver === userAddressLower) {
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
          <div className="d-flex flex-column p-4 mb-4" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h2 className="mb-3">
              User Profile <Badge bg="secondary" className="ms-2">{userAddress}</Badge>
            </h2>
            <Tabs defaultActiveKey="sender" id="user-offers-tabs" className="mb-3 mt-3">
              <Tab eventKey="sender" title="Sender Profile">
                <div className="p-3 mb-4" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                  <p>
                    <strong>Description:</strong>{' '}
                    {userProfile.descriptionAsSender || 'No description provided.'}
                  </p>
                  <p>
                    <strong>Average Score:</strong>{' '}
                    {userProfile.averageScoreAsSender !== 'N/A' ? (
                      <>
                        {renderStarRating(parseFloat(userProfile.averageScoreAsSender))}{' '}
                        ({userProfile.averageScoreAsSender})
                      </>
                    ) : (
                      'N/A'
                    )}
                  </p>
                  <p>
                    <strong>Offers Accepted:</strong>{' '}
                    {userProfile.numOffersAcceptedAsSender}
                  </p>
                  <p>
                    <strong>Offers Finalized:</strong>{' '}
                    {userProfile.numOffersFinalizedAsSender}
                  </p>
                  {userAddress.toLowerCase() === account.toLowerCase() && (
                    <Button
                      variant="primary"
                      onClick={() => setShowDescriptionModal(true)}
                      className="mt-3"
                    >
                      Set Description
                    </Button>
                  )}
                </div>

                {userOffersAsSender.length > 0 ? (
                  <Row className="g-4">
                    {userOffersAsSender.map((offer, index) => (
                      <Col key={index} lg={12} md={12} sm={12}>
                        <OfferCard
                          offer={offer}
                          usdcDecimals={usdcDecimals}
                          account={account}
                          loading={false}
                          cancelOffer={() => {}}
                          finalizeOffer={() => {}}
                          forfeitOffer={() => {}}
                          hideActions
                          averageScore={offer.averageScore}
                          requestParticipationForOffer={() => {}}
                          canChooseParticipantForOffer={() => {}}
                          isExpired={false}
                          onChat={onChat}
                          onSelectMenu={onSelectMenu}
                          onSetProfileAddress={onSetProfileAddress}
                        />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <p className="text-muted">No offers found where this user is the sender.</p>
                )}
              </Tab>

              <Tab eventKey="receiver" title="Receiver Profile">
                <div className="p-3 mb-4" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                  <p>
                    <strong>Offers Accepted:</strong>{' '}
                    {userProfile.numOffersAcceptedAsReceiver}
                  </p>
                  <p>
                    <strong>Offers Finalized:</strong>{' '}
                    {userProfile.numOffersFinalizedAsReceiver}
                  </p>
                </div>

                {userOffersAsReceiver.length > 0 ? (
                  <Row className="g-4">
                    {userOffersAsReceiver.map((offer, index) => (
                      <Col key={index} lg={12} md={12} sm={12}>
                        <OfferCard
                          offer={offer}
                          usdcDecimals={usdcDecimals}
                          account={account}
                          loading={false}
                          cancelOffer={() => {}}
                          finalizeOffer={() => {}}
                          forfeitOffer={() => {}}
                          hideActions
                          averageScore={offer.averageScore}
                          requestParticipationForOffer={() => {}}
                          canChooseParticipantForOffer={() => {}}
                          isExpired={false}
                          onChat={onChat}
                          onSelectMenu={onSelectMenu}
                          onSetProfileAddress={onSetProfileAddress}
                        />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <p className="text-muted">No offers found where this user is the receiver.</p>
                )}
              </Tab>
            </Tabs>
          </div>
        </>
      ) : (
        <p className="text-muted">No profile information available.</p>
      )}
    </Container>
  );
};

/** ======================
 *        Main App
 =======================*/
function App() {
  // -- States
  const [networkEnv, setNetworkEnv] = useState('unknown');
  const networkKeys = Object.keys(PalketInfo.networks);

  // Use a fallback object if the networkEnv is not found in PalketInfo
  const networkConfig = PalketInfo.networks[networkEnv] || {
    chainId: '0x0',
    name: 'Unsupported Network',
    isTestnet: false,
    currencyName: '',
    currencySymbol: '',
    currencyDecimals: 18,
    rpcUrl: '',
    blockExplorerUrl: '',
    palketaddress: '',
    usdcaddress: '',
    palketabi: [],
    usdcabi: [],
  };

  const {
    chainId,
    name: networkName,
    isTestnet,
    currencyName,
    currencySymbol,
    currencyDecimals,
    rpcUrl,
    blockExplorerUrl,
    palketaddress,
    usdcaddress,
    palketabi,
    usdcabi,
  } = networkConfig;


  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [marketplaceContract, setMarketplaceContract] = useState(null);
  const [depositPercentage, setDepositPercentage] = useState(null);
  const [finalizeFeePercentage, setFinalizeFeePercentage] = useState(null);
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
  const [nativeBalance, setNativeBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState('');
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintLoading, setMintLoading] = useState(false);

  const [xmtpClient, setXmtpClient] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentOfferForParticipation, setCurrentOfferForParticipation] = useState(null);

  const [showChooseModal, setShowChooseModal] = useState(false);
  const [currentOfferForChoosing, setCurrentOfferForChoosing] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);

  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Track the address we want to chat with
  const [currentChatAddress, setCurrentChatAddress] = useState(null);
  // Track which profile to show
  const [selectedProfileAddress, setSelectedProfileAddress] = useState(null);

  // The main navigation selection
  const [selectedMenu, setSelectedMenu] = useState('Home');

  // Effects

  useEffect(() => {
    async function detectWalletNetwork() {
      if (window.ethereum) {
        try {
          // Request the current chain ID from MetaMask
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const chainIdDecimal = parseInt(chainIdHex, 16);
          const detectedKey = getNetworkKeyForChainId(chainIdDecimal);
          if (detectedKey) {
            console.log("Detected wallet network:", detectedKey, chainIdHex);
            setNetworkEnv(detectedKey);
          } else {
            console.warn(`Wallet is connected to an unsupported chain (${chainIdHex}).`);
            setNetworkEnv('unknown');
            setMessage({
              type: 'warning',
              text: `Your current network (chainId ${chainIdHex}) is not supported by this app. Please switch to a supported network.`,
            });
          }
        } catch (error) {
          console.error("Error detecting wallet network:", error);
        }
      }
    }
    detectWalletNetwork();
  }, []);
  
  // Auto-connect wallet on page load if already authorized
  useEffect(() => {
    async function autoConnectWallet() {
      if (window.ethereum && !account) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            console.log("Auto-connecting wallet on page load:", accounts[0]);
            await connectWallet();
          }
        } catch (error) {
          console.error("Error auto-connecting wallet:", error);
        }
      }
    }
    autoConnectWallet();
  }, []);


  useEffect(() => {
    initNetwork();
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
  }, [networkEnv]);

  useEffect(() => {
    async function reInitialize() {
      if (!provider || !account || !marketplaceContract) return;
  
      // If networkEnv is 'unknown', do not proceed.
      if (networkEnv === 'unknown') {
        console.warn("Current network is not supported. Skipping re-initialization.");
        return;
      }
  
      try {
        const currentNetwork = await provider.getNetwork();
        const targetChainDecimal = parseInt(PalketInfo.networks[networkEnv].chainId, 16);
        if (currentNetwork.chainId === targetChainDecimal) {
          console.log(`Re-initializing with correct chain: ${currentNetwork.chainId}`);
          await loadContractParams();
          await loadOffers(marketplaceContract);
          await loadUserDescription();
        } else {
          console.log(
            `Skipping loads. currentNetwork.chainId=${currentNetwork.chainId}, expected=${targetChainDecimal}`
          );
        }
      } catch (err) {
        console.error('Error in reInitialize:', err);
      }
    }
    reInitialize();
  }, [provider, account, marketplaceContract, networkEnv]);
  
  

  useEffect(() => {
    loadUsdcBalance();
    loadNativeBalance();
  }, [usdcContract, account, usdcDecimals, provider]);

  useEffect(() => {
    if (account) {
      setSelectedProfileAddress(account);
    }
  }, [account]);

  // Handlers
  const onChat = (address) => {
    setCurrentChatAddress(address);
  };

  const loadContractParams = async () => {
    try {
      const dp = await marketplaceContract.depositPercentage();
      const ff = await marketplaceContract.finalizeFeePercentage();
      setDepositPercentage(Number(dp));
      setFinalizeFeePercentage(Number(ff));
    } catch (error) {
      console.error('Error fetching contract params:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching contract parameters: ' + (error.reason || error.message),
      });
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // No account connected: clear all account-dependent state.
      setAccount('');
      setXmtpClient(null);
      setSelectedProfileAddress('');
      setUsdcBalance(null);
      setNativeBalance(null);
    } else {
      const newAccount = accounts[0];
      // If the new account differs from the current account...
      if (!account || newAccount.toLowerCase() !== account.toLowerCase()) {
        // Clear state that is specific to the previous account.
        setXmtpClient(null);
        setSelectedProfileAddress(newAccount);
        // Reinitialize the wallet connection.
        await connectWallet();
      }
    }
  };
  

  // Helper: get network key from chainId (as decimal)
  const getNetworkKeyForChainId = (chainIdDecimal) => {
    const networks = PalketInfo.networks;
    return Object.keys(networks).find((key) => {
      // Get the chainId from the network config.
      // It might be a hex string (like "0xaa36a7") or a decimal string/number.
      const networkChainId = networks[key].chainId;
      // Normalize the chainId: if it's a string starting with '0x', parse as hex; otherwise, parse as decimal.
      const parsedNetworkChainId =
        typeof networkChainId === 'string'
          ? parseInt(networkChainId, networkChainId.startsWith('0x') ? 16 : 10)
          : networkChainId;
      return parsedNetworkChainId === chainIdDecimal;
    });
  };

  const handleChainChanged = async (newChainIdHex) => {
    console.log('Chain changed to:', newChainIdHex);
    // Option 1: simply reload the page
    window.location.reload();
  };
  

  

  function normalizeChainId(chainId) {
    // If it’s already 0x-prefixed, assume it’s correct
    if (chainId.toLowerCase().startsWith('0x')) {
      return chainId.toLowerCase();
    }
    // Otherwise, parse as decimal and convert to 0x-hex
    const hex = parseInt(chainId, 10).toString(16);
    return '0x' + hex;
  }

  const switchNetworkIfNeeded = async () => {
    
    // If we haven't detected a supported network, don't try switching.
    if (networkEnv === 'unknown') {
      console.warn("Unsupported network; skipping network switch.");
      return;
    }

    if (isSwitchingNetwork) {
      console.log('Network switch already in progress.');
      return;
    }

    setIsSwitchingNetwork(true);

    if (!window.ethereum) {
      console.log('MetaMask is not installed.');
      setMessage({
        type: 'danger',
        text: 'MetaMask is not installed. Please install it to use this app.',
      });
      setIsSwitchingNetwork(false);
      return;
    }

    try {
      const chainIdCurrent = await window.ethereum.request({ method: 'eth_chainId' });
      // Convert our decimal chainId from PalketInfo to a proper 0x-hex string
      const targetChainIdHex = normalizeChainId(chainId);
      if (chainIdCurrent.toLowerCase() === targetChainIdHex.toLowerCase()) {
        // Already on correct network
        setIsSwitchingNetwork(false);
        return;
      }
      // Attempt switch
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }],
      });
    } catch (switchError) {
      console.error('Error switching network:', switchError);
      if (switchError.code === 4902) {
        // Add chain to MetaMask
        const params = {
          chainId: targetChainIdHex, // must be 0x-hex
          chainName: networkName,
          rpcUrls: [rpcUrl],
          nativeCurrency: {
            name: currencyName,
            symbol: currencySymbol,
            decimals: parseInt(currencyDecimals),
          },
        };
          
        if (blockExplorerUrl && blockExplorerUrl.startsWith('https://')) {
          params.blockExplorerUrls = [blockExplorerUrl];
        }
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          setMessage({
            type: 'danger',
            text: `Error adding network: ${addError.message || addError}`,
          });
        }
      } else {
        setMessage({
          type: 'danger',
          text: `Error switching network: ${switchError.message || switchError}`,
        });
      }
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const initNetwork = async () => {
    await switchNetworkIfNeeded();
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        setLoading(false);
        return;
      }
      if (networkEnv === 'unknown') {
        setMessage({
          type: 'warning',
          text: 'Your wallet is connected to an unsupported network. Please switch to a supported network.'
        });
        setLoading(false);
        return;
      }
      // Attempt network switch if needed.
      await switchNetworkIfNeeded();
  
      // Request accounts.
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const tempAccount = accounts[0];
      
      // If the account has changed, clear account-specific state.
      if (account && tempAccount.toLowerCase() !== account.toLowerCase()) {
        setXmtpClient(null);
        setSelectedProfileAddress(tempAccount);
      }
      
      // Create provider, signer, etc.
      const tempProvider = new BrowserProvider(window.ethereum);
      const tempSigner = await tempProvider.getSigner();
      
      // Double-check chain.
      const chainIdCurrent = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainIdCurrent.toLowerCase() !== normalizeChainId(chainId).toLowerCase()) {
        setMessage({
          type: 'warning',
          text: `You must switch to ${networkName} to proceed.`
        });
        return;
      }
      
      const tempMarketplaceContract = new Contract(palketaddress, palketabi, tempSigner);
      const tempUsdcContract = new Contract(usdcaddress, usdcabi, tempSigner);
      const tempUsdcDecimals = await tempUsdcContract.decimals();
      
      // Update state.
      setProvider(tempProvider);
      setSigner(tempSigner);
      setAccount(tempAccount);
      setMarketplaceContract(tempMarketplaceContract);
      setUsdcContract(tempUsdcContract);
      setUsdcDecimals(tempUsdcDecimals);
      
      console.log("Wallet connected:", tempAccount, "on network:", chainIdCurrent);
      
      // Load account-specific data.
      await loadOffers(tempMarketplaceContract);
      await loadUserDescription();
      await initializeXmtp(tempProvider, tempSigner, tempAccount);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setMessage({
        type: 'danger',
        text: `Error connecting wallet: ${error.message || error}`
      });
    } finally {
      setLoading(false);
    }
  };
  

  const changeAccount = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        setMessage({
          type: 'danger',
          text: 'MetaMask is not installed.',
        });
      }
    } catch (error) {
      console.error('Error changing account:', error);
      setMessage({
        type: 'danger',
        text: 'Error changing account: ' + (error.reason || error.message),
      });
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

  const loadNativeBalance = async () => {
    try {
      if (provider && account) {
        const balance = await provider.getBalance(account);
        const formattedBalance = parseFloat(
          formatUnits(balance, parseInt(currencyDecimals))
        ).toFixed(4);
        setNativeBalance(formattedBalance);
      }
    } catch (error) {
      console.error('Error fetching native balance:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching native balance: ' + (error.reason || error.message),
      });
    }
  };

  const handleMintUSDC = async (e) => {
    e.preventDefault();
    try {
      if (!mintAmount || isNaN(mintAmount) || parseFloat(mintAmount) <= 0) {
        setMessage({ type: 'danger', text: 'Please enter a valid mint amount.' });
        return;
      }
      const recipient = mintRecipient.trim() === '' ? account : mintRecipient.trim();
      const amountInWei = parseUnits(mintAmount, usdcDecimals);

      setMintLoading(true);
      const tx = await usdcContract.mint(recipient, amountInWei);
      await tx.wait();

      setMessage({
        type: 'success',
        text: `Successfully minted ${mintAmount} USDC to ${recipient}.`,
      });
      setMintAmount('');
      setMintRecipient('');
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error minting USDC:', error);
      setMessage({
        type: 'danger',
        text: 'Error minting USDC: ' + (error.reason || error.message),
      });
    } finally {
      setMintLoading(false);
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

      // Collect average scores for senders
      for (let offer of tempAllOffers) {
        const senderAddress = offer.sender.toLowerCase();
        if (senderAddress !== ZeroAddress.toLowerCase()) {
          if (!userStats[senderAddress]) {
            const profile = await contract.userProfiles(senderAddress);
            const totalScore = Number(profile.totalScoreAsSender);
            const numFinalized = Number(profile.numOffersFinalizedAsSender);
            const averageScore =
              numFinalized > 0
                ? parseFloat(totalScore / numFinalized).toFixed(2)
                : 'N/A';
            userStats[senderAddress] = { averageScore };
          }
        }
      }

      // Attach averageScore
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
      console.error('Error loading user description:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading description: ' + (error.reason || error.message),
      });
    }
  };

  const handleInputChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  };

  // Creating offers
  const createOffer = async (offerType) => {
    try {
      setLoading(true);
      const { productDescription, productValue } = formValues;

      // Basic checks
      if (!productDescription) {
        setMessage({ type: 'danger', text: 'Please provide a product description.' });
        setLoading(false);
        return;
      }

      if (offerType === 'ReceiverInitiated') {
        // No upfront from receiver
        const tx = await marketplaceContract.createOfferByReceiver(productDescription);
        await tx.wait();
        setMessage({ type: 'success', text: 'Offer created successfully!' });
        setFormValues({
          productDescription: '',
          productValue: '',
          offerType: 'ReceiverInitiated',
        });
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      } else {
        // Sender-initiated
        if (!productValue || parseFloat(productValue) <= 0) {
          setMessage({ type: 'danger', text: 'Please provide a valid product value.' });
          setLoading(false);
          return;
        }

        const productValueString = productValue.toString();
        const valueInWei = parseUnits(productValueString, usdcDecimals);
        const valueInBigInt = ethersToBigInt(valueInWei);

        // Check deposit from contract
        const dp = await marketplaceContract.depositPercentage(); // e.g. 50
        const deposit = (valueInBigInt * BigInt(dp)) / BigInt(100);
        const depositUSDC = parseFloat(formatUnits(deposit, usdcDecimals)).toFixed(2);

        // Show confirmation for deposit
        setConfirmAmount(depositUSDC);
        setShowConfirmModal(true);

        // Callback
        setConfirmCallback(() => async () => {
          setLoading(true);

          // Approve if needed
          const currentAllowance = await usdcContract.allowance(account, palketaddress);
          if (currentAllowance < deposit) {
            const approveTx = await usdcContract.approve(palketaddress, deposit);
            await approveTx.wait();
          }

          const tx = await marketplaceContract.createOfferBySender(
            productDescription,
            productValueString
          );
          await tx.wait();

          setMessage({ type: 'success', text: 'Offer created successfully!' });
          setFormValues({
            productDescription: '',
            productValue: '',
            offerType: 'ReceiverInitiated',
          });
          await loadOffers(marketplaceContract);
          await loadUsdcBalance();
          await loadNativeBalance();
        });
      }
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

  const cancelOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.cancelOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer cancelled successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
      await loadNativeBalance();
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
      await loadNativeBalance();
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

  const forfeitOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.forfeitOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: `Offer ${offerId} forfeited successfully!` });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
      await loadNativeBalance();
    } catch (error) {
      console.error(`Error forfeiting offer ${offerId}:`, error);
      setMessage({
        type: 'danger',
        text: `Error forfeiting offer ${offerId}: ${error.reason || error.message}`,
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
        setLoading(false);
        return;
      }

      for (let offer of expiredOffers) {
        // Forfeit them one by one
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

  const requestParticipationForOffer = (offer) => {
    setCurrentOfferForParticipation(offer);
    setShowRequestModal(true);
  };

  const handleRequestParticipation = async (bidValue) => {
    try {
      setLoading(true);
      const offer = currentOfferForParticipation;
      let totalAmount;

      if (offer.offerType === 0) {
        // ReceiverInitiated => user provides bidPrice + deposit
        const bidInWei = parseUnits(bidValue, usdcDecimals);
        const dp = await marketplaceContract.depositPercentage();
        const deposit = (ethersToBigInt(bidInWei) * BigInt(dp)) / BigInt(100);
        totalAmount = deposit;
      } else {
        // SenderInitiated => user must lock productValue + deposit
        totalAmount = offer.productValue + offer.deposit;
      }

      const totalUSDC = parseFloat(formatUnits(totalAmount, usdcDecimals)).toFixed(2);

      // Show confirm modal
      setConfirmAmount(totalUSDC);
      setShowConfirmModal(true);

      setConfirmCallback(() => async () => {
        setLoading(true);

        // Approve
        const allowance = await usdcContract.allowance(account, palketaddress);
        if (allowance < totalAmount) {
          const approveTx = await usdcContract.approve(palketaddress, totalAmount);
          await approveTx.wait();
        }

        // XMTP: Provide consent to counterpart user
        await xmtpClient.setConsentStates([
          {
            entity: offer.offerType === 0 ? offer.receiver : offer.sender,
            entityType: ConsentEntityType.Address,
            state: ConsentState.allowed,
          },
        ]);

        const tx = await marketplaceContract.requestParticipation(
          offer.offerId,
          offer.offerType === 0 ? bidValue : 0
        );
        await tx.wait();

        setMessage({ type: 'success', text: 'Participation requested successfully!' });
        setShowRequestModal(false);
        setCurrentOfferForParticipation(null);
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      });
    } catch (error) {
      console.error('Error requesting participation:', error);
      setMessage({
        type: 'danger',
        text: 'Error requesting participation: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const canChooseParticipantForOffer = async (offer) => {
    setCurrentOfferForChoosing(offer);
    setShowChooseModal(true);
    await loadParticipantsForOffer(offer.offerId);
  };

  const loadParticipantsForOffer = async (offerId) => {
    setLoadingParticipants(true);
    try {
      let arr = [];
      let i = 0;
      while (true) {
        try {
          const p = await marketplaceContract.participationRequests(offerId, i);
          const applicant = p[0];
          const bidPrice = Number(p[2]);
          const bidPriceFormatted =
            bidPrice > 0
              ? parseFloat(formatUnits(bidPrice, usdcDecimals)).toFixed(2)
              : 0;
          arr.push({ applicant, bidPrice: bidPriceFormatted });
          i++;
        } catch (error) {
          break;
        }
      }
      setParticipants(arr);
    } catch (error) {
      console.error('Error loading participants:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading participants: ' + (error.reason || error.message),
      });
    } finally {
      setLoadingParticipants(false);
    }
  };

  const chooseParticipant = async (participantAddress) => {
    try {
      setLoading(true);
      const offerId = currentOfferForChoosing.offerId;
      let totalAmount = 0n;

      if (currentOfferForChoosing.offerType === 0) {
        // ReceiverInitiated => receiver must lock P+D for chosen participant
        const chosenPart = participants.find(
          (p) => p.applicant.toLowerCase() === participantAddress.toLowerCase()
        );
        if (!chosenPart) {
          setMessage({ type: 'danger', text: 'Chosen participant not found.' });
          return;
        }
        const bidWei = parseUnits(chosenPart.bidPrice.toString(), usdcDecimals);
        const dp = await marketplaceContract.depositPercentage();
        const deposit = (ethersToBigInt(bidWei) * BigInt(dp)) / BigInt(100);
        totalAmount = bidWei + deposit;
      } else {
        // SenderInitiated => no extra from the sender to choose
        totalAmount = 0n;
      }

      const totalUSDC = parseFloat(formatUnits(totalAmount, usdcDecimals)).toFixed(2);

      if (totalAmount > 0n) {
        setConfirmAmount(totalUSDC);
        setShowConfirmModal(true);
        setConfirmCallback(() => async () => {
          setLoading(true);
          const allowance = await usdcContract.allowance(account, palketaddress);
          if (allowance < totalAmount) {
            const approveTx = await usdcContract.approve(palketaddress, totalAmount);
            await approveTx.wait();
          }

          // XMTP: Provide Consent
          await xmtpClient.setConsentStates([
            {
              entity: participantAddress,
              entityType: ConsentEntityType.Address,
              state: ConsentState.Allowed,
            },
          ]);

          const tx = await marketplaceContract.chooseParticipant(offerId, participantAddress);
          await tx.wait();

          setMessage({ type: 'success', text: 'Participant chosen successfully!' });
          setShowChooseModal(false);
          setCurrentOfferForChoosing(null);
          setParticipants([]);
          await loadOffers(marketplaceContract);
          await loadUsdcBalance();
          await loadNativeBalance();
        });
      } else {
        // No extra USDC transfer from the chooser
        const tx = await marketplaceContract.chooseParticipant(offerId, participantAddress);
        await tx.wait();

        setMessage({ type: 'success', text: 'Participant chosen successfully!' });
        setShowChooseModal(false);
        setCurrentOfferForChoosing(null);
        setParticipants([]);
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      }
    } catch (error) {
      console.error('Error choosing participant:', error);
      setMessage({
        type: 'danger',
        text: 'Error choosing participant: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  // XMTP / Chat
  // Convert hex key to bytes
  function hexToBytes(hex) {
    if (hex.startsWith('0x')) {
      hex = hex.slice(2);
    }
    if (hex.length !== 64) {
      throw new Error('Hex string must be 64 characters (32 bytes).');
    }
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
      bytes.push(parseInt(hex.substring(c, c + 2), 16));
    }
    return new Uint8Array(bytes);
  }

  async function generateEncryptionBytes(localSigner, localAccount) {
    // 1. Deterministic seed message
    const seedMessage = `XMTP key seed for address: ${localAccount}`;
  
    // 2. User signs the seed message
    const rawSignature = await localSigner.signMessage(seedMessage);
  
    // 3. Hash the signature (keccak256) -> 32 bytes
    //    ethers.utils.keccak256 returns a hex string (0x...).
    //    Convert that hex string to a Uint8Array/Bytes
    const hashedSignature = keccak256(rawSignature);
    const encryptionBytes = getBytes(hashedSignature);
    console.log("Palket rocks! ", encryptionBytes);
    return encryptionBytes;
  }

  const initializeXmtp = async (localProvider, localSigner, localAccount) => {
    try {
      if (!localProvider) throw new Error('No provider found, cannot initialize XMTP.');
      if (!localAccount) throw new Error('No account found, cannot initialize XMTP.');

      // 1. Generate repeatable encryption bytes via signature + hash
      const encryptionBytes = await generateEncryptionBytes(localSigner, localAccount);

      // 2. XMTP-compatible “signer”
      const xmtpSigner = {
        getAddress: () => localAccount,
        signMessage: async (message) => {
          const signature = await localSigner.signMessage(message);
          return toBytes(signature);
        },
      };

      // 3. Create the XMTP client
      const client = await Client.create(xmtpSigner, encryptionBytes, {
        env: xmtpEnv,
      });
      setXmtpClient(client);
      

    } catch (error) {
      console.error('Error initializing XMTP client:', error);
      alert(`XMTP initialization failed: ${error.message}`);
    }
  };

  // Switch Network from dropdown
  const switchNetwork = async (key) => {
    // Look up the network configuration in your JSON
    const config = PalketInfo.networks[key];
    if (!config) {
      console.error("Network key not found in configuration:", key);
      setMessage({ type: 'danger', text: `Network configuration not found for ${key}` });
      return;
    }
  
    // Normalize the chainId to a hex string (wallet expects a 0x-hex string)
    const targetChainIdHex = normalizeChainId(config.chainId);
  
    try {
      // Request the wallet to switch networks
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }],
      });
      // If successful, update the local state so that your app uses the new network config
      setNetworkEnv(key);
      setMessage({
        type: 'info',
        text: `Switched to ${config.name} (chainId: ${targetChainIdHex}).`,
      });
    } catch (error) {
      // If the error indicates the chain is not added (error code 4902), try to add it
      if (error.code === 4902) {
        try {
          const params = {
            chainId: targetChainIdHex,
            chainName: config.name,
            rpcUrls: [config.rpcUrl],
            nativeCurrency: {
              name: config.currencyName,
              symbol: config.currencySymbol,
              decimals: parseInt(config.currencyDecimals, 10),
            },
            ...(config.blockExplorerUrl && config.blockExplorerUrl.startsWith('https://')
              ? { blockExplorerUrls: [config.blockExplorerUrl] }
              : {}),
          };
  
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
          // After successfully adding, try switching again
          setNetworkEnv(key);
          setMessage({
            type: 'info',
            text: `Network added and switched to ${config.name} (chainId: ${targetChainIdHex}).`,
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          setMessage({
            type: 'danger',
            text: `Error adding network: ${addError.message || addError}`,
          });
        }
      } else {
        console.error('Error switching network:', error);
        setMessage({
          type: 'danger',
          text: `Error switching network: ${error.message || error}`,
        });
      }
    }
  };
  

  // ConfirmTransaction Modal handlers
  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setConfirmAmount('');
    setConfirmCallback(null);
  };

  const handleConfirmProceed = async () => {
    if (confirmCallback) {
      await confirmCallback();
    }
    setShowConfirmModal(false);
    setConfirmAmount('');
    setConfirmCallback(null);
  };

  return (
    <div>
      {isTestnet === '1' && (
        <Alert variant="info" className="text-center mb-4">
          <strong>Test Mode:</strong> Connected to {networkName}
          <Form onSubmit={handleMintUSDC} className="d-inline-flex align-items-center ms-3">
            <Form.Group controlId="mintAmount" className="mb-0 me-2">
              <Form.Control
                type="number"
                placeholder="Amount to Mint (USDC)"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                min="0"
                step="0.01"
                size="sm"
              />
            </Form.Group>
            <Button variant="success" type="submit" disabled={mintLoading} size="sm">
              {mintLoading ? <Spinner animation="border" size="sm" /> : 'Mint USDC'}
            </Button>
          </Form>
        </Alert>
      )}
      {/* Navbar */}
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container fluid>
          <Navbar.Brand href="#" className="d-flex align-items-center">
            <img
              src={palketLogo}
              width="40"
              height="40"
              className="d-inline-block align-top me-2"
              alt="Palket Logo"
            />
            <div style={{ lineHeight: '1.2' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.5em' }}>Palket:</span>
              <br />
              The Pal-to-Pal Market
            </div>
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="navbarResponsive" />

          <Navbar.Collapse id="navbarResponsive">
            <Nav className="me-auto">
              <Nav.Link
                eventKey="Home"
                active={selectedMenu === 'Home'}
                onClick={() => setSelectedMenu('Home')}
              >
                Home
              </Nav.Link>
              <Nav.Link
                eventKey="Buy"
                active={selectedMenu === 'Buy'}
                onClick={() => setSelectedMenu('Buy')}
              >
                Buy
              </Nav.Link>
              <Nav.Link
                eventKey="Sell"
                active={selectedMenu === 'Sell'}
                onClick={() => setSelectedMenu('Sell')}
              >
                Sell
              </Nav.Link>
              <Nav.Link
                eventKey="Lottery"
                active={selectedMenu === 'Lottery'}
                onClick={() => setSelectedMenu('Lottery')}
              >
                Lottery
              </Nav.Link>
              <Nav.Link
                eventKey="Chat"
                active={selectedMenu === 'Chat'}
                onClick={() => setSelectedMenu('Chat')}
              >
                Chat
              </Nav.Link>
              <Nav.Link
                eventKey="Profile"
                active={selectedMenu === 'Profile'}
                onClick={() => setSelectedMenu('Profile')}
              >
                Profile
              </Nav.Link>
            </Nav>

            <Nav className="ms-auto align-items-center">
              <div className="text-center me-3">
                <div style={{ fontWeight: 'bold' }}>
                  {account
                    ? `Account: ${account.substring(0, 6)}...${account.substring(account.length - 4)}`
                    : 'Not connected'}
                </div>
                {account && (
                  <div>
                    <div>
                      {nativeBalance !== null
                        ? `${nativeBalance} ${currencySymbol}`
                        : '...'}
                    </div>
                    <div>
                      {usdcBalance !== null ? `${usdcBalance} USDC` : '...'}
                    </div>
                  </div>
                )}
              </div>
              {/* Use the current network's name instead of "Network" */}
              <NavDropdown title={networkName} id="network-dropdown" className="me-3">
                {networkKeys.map((key) => (
                  <NavDropdown.Item key={key} onClick={() => switchNetwork(key)}>
                    {PalketInfo.networks[key].name}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
              <Button
                variant="outline-light"
                onClick={account ? changeAccount : connectWallet}
              >
                {account ? 'Change Account' : 'Connect'}
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Always show the Home tab content (even if not connected) */}
      {selectedMenu === 'Home' && <Wiki setSelectedMenu={setSelectedMenu} />}

      {/* If not connected, show a special alert and connect button. 
          Otherwise, show the other tabs’ content. */}
      {!account ? (
        <Container className="mt-4">
          <Alert variant="info" className="border border-secondary">
            <strong>Wallet not connected!</strong>
            <br />
            Don’t be shy—click the “Connect” button in the top-right corner and let’s get this
            show on the road!
            <div className="mt-3">
              <Button variant="primary" onClick={connectWallet}>
                Connect
              </Button>
            </div>
          </Alert>
        </Container>
      ) : (
        <Container fluid className="mt-4">
          {message && (
            <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
              {message.text}
            </Alert>
          )}

          {/* Condition: selectedMenu === 'Buy' */}
          {selectedMenu === 'Buy' && (
            <div className="p-3">
              <h5>Buy Products/Services with Crypto</h5>
              <Alert variant="secondary">
                <strong>Receiver-Initiated Offers:</strong>
                <br />
                Here, you (the buyer/receiver) only need to provide a description.
                Sellers will “request participation” by bidding with a deposit.
                Once you choose a participant, the offer becomes Accepted.
              </Alert>

              <h6>Create Offer</h6>
              <Form>
                <Form.Group controlId="productDescription">
                  <Form.Label>Product Description</Form.Label>
                  <Form.Control
                    type="text"
                    name="productDescription"
                    placeholder="Describe what you need"
                    value={formValues.productDescription}
                    onChange={handleInputChange}
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={() => createOffer('ReceiverInitiated')}
                  disabled={loading}
                  className="mt-3"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Create Offer'}
                </Button>
              </Form>

              <h6 className="mt-4">
                Active Purchase Offers
                <Button
                  variant="outline-primary"
                  onClick={() => loadOffers(marketplaceContract)}
                  className="ms-2"
                >
                  Refresh
                </Button>
              </h6>
              {allOffers.filter((offer) => offer.offerType === 1 && offer.state === 0)
                .length > 0 ? (
                <Row className="g-4 mt-2">
                  {allOffers
                    .filter((offer) => offer.offerType === 1 && offer.state === 0)
                    .map((offer, index) => (
                      <Col key={index} lg={12} md={12} sm={12}>
                        <OfferCard
                          offer={offer}
                          usdcDecimals={usdcDecimals}
                          account={account}
                          loading={loading}
                          cancelOffer={cancelOffer}
                          finalizeOffer={finalizeOffer}
                          forfeitOffer={forfeitOffer}
                          averageScore={offer.averageScore}
                          requestParticipationForOffer={requestParticipationForOffer}
                          canChooseParticipantForOffer={canChooseParticipantForOffer}
                          isExpired={false}
                          onChat={onChat}
                          onSelectMenu={setSelectedMenu}
                          onSetProfileAddress={setSelectedProfileAddress}
                        />
                      </Col>
                    ))}
                </Row>
              ) : (
                <p className="text-muted">No active purchase offers.</p>
              )}
            </div>
          )}

          {/* Condition: selectedMenu === 'Sell' */}
          {selectedMenu === 'Sell' && (
            <div className="p-3">
              <h5>Sell Products/Services for Crypto</h5>
              <Alert variant="secondary">
                <strong>Sender-Initiated Offers:</strong>
                <br />
                You (the seller/sender) lock a portion of your product value as a deposit.
                Potential buyers then lock the entire product value plus a deposit when requesting
                participation.
              </Alert>

              <h6>Create Offer as Seller</h6>
              <Form>
                <Form.Group controlId="productDescription">
                  <Form.Label>Product Description</Form.Label>
                  <Form.Control
                    type="text"
                    name="productDescription"
                    placeholder="What are you selling?"
                    value={formValues.productDescription}
                    onChange={handleInputChange}
                  />
                </Form.Group>

                <Form.Group controlId="productValue" className="mt-2">
                  <Form.Label>Product Value (USDC)</Form.Label>
                  <Form.Control
                    type="number"
                    name="productValue"
                    placeholder="Product Value"
                    value={formValues.productValue}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={() => createOffer('SenderInitiated')}
                  disabled={loading}
                  className="mt-3"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Create Offer'}
                </Button>
              </Form>

              <h6 className="mt-4">
                Active Sales Offers
                <Button
                  variant="outline-primary"
                  onClick={() => loadOffers(marketplaceContract)}
                  className="ms-2"
                >
                  Refresh
                </Button>
              </h6>
              {allOffers.filter((offer) => offer.offerType === 0 && offer.state === 0)
                .length > 0 ? (
                <Row className="g-4 mt-2">
                  {allOffers
                    .filter((offer) => offer.offerType === 0 && offer.state === 0)
                    .map((offer, index) => (
                      <Col key={index} lg={12} md={12} sm={12}>
                        <OfferCard
                          offer={offer}
                          usdcDecimals={usdcDecimals}
                          account={account}
                          loading={loading}
                          cancelOffer={cancelOffer}
                          finalizeOffer={finalizeOffer}
                          forfeitOffer={forfeitOffer}
                          averageScore={offer.averageScore}
                          requestParticipationForOffer={requestParticipationForOffer}
                          canChooseParticipantForOffer={canChooseParticipantForOffer}
                          isExpired={false}
                          onChat={onChat}
                          onSelectMenu={setSelectedMenu}
                          onSetProfileAddress={setSelectedProfileAddress}
                        />
                      </Col>
                    ))}
                </Row>
              ) : (
                <p className="text-muted">No active sales offers.</p>
              )}
            </div>
          )}

          {/* Condition: selectedMenu === 'Lottery' */}
          {selectedMenu === 'Lottery' && (
            <div className="p-3">
              <h5>Lottery</h5>
              <Alert variant="secondary">
                Offers that remain <strong>Accepted</strong> but are never finalized for too long
                (e.g. 180 days) can be <strong>forfeited</strong>. Part of the funds go to the
                caller, part to the contract owner, and the rest to a random participant.
              </Alert>

              <h6>Expired Accepted Offers
                <Button
                  variant="outline-primary"
                  onClick={() => loadOffers(marketplaceContract)}
                  className="ms-2"
                >
                  Refresh
                </Button>
              </h6>
              {allOffers.filter(
                (offer) =>
                  offer.state === 1 &&
                  offer.acceptanceTime + 180 * 24 * 60 * 60 <=
                    Math.floor(Date.now() / 1000)
              ).length > 0 ? (
                <Row className="g-4 mt-2">
                  {allOffers
                    .filter(
                      (offer) =>
                        offer.state === 1 &&
                        offer.acceptanceTime + 180 * 24 * 60 * 60 <=
                          Math.floor(Date.now() / 1000)
                    )
                    .map((offer, index) => (
                      <Col key={index} lg={12} md={12} sm={12}>
                        <OfferCard
                          offer={offer}
                          usdcDecimals={usdcDecimals}
                          account={account}
                          loading={loading}
                          cancelOffer={cancelOffer}
                          finalizeOffer={finalizeOffer}
                          forfeitOffer={forfeitOffer}
                          averageScore={offer.averageScore}
                          requestParticipationForOffer={requestParticipationForOffer}
                          canChooseParticipantForOffer={canChooseParticipantForOffer}
                          isExpired={true}
                          onChat={onChat}
                          onSelectMenu={setSelectedMenu}
                          onSetProfileAddress={setSelectedProfileAddress}
                        />
                      </Col>
                    ))}
                </Row>
              ) : (
                <p className="text-muted">No expired accepted offers available for forfeiture.</p>
              )}

              <Button
                variant="warning"
                onClick={handleForfeitExpiredOffers}
                disabled={loading}
                className="mt-3"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Expired Offers'}
              </Button>
            </div>
          )}

          {/* Condition: selectedMenu === 'Chat' */}
          {selectedMenu === 'Chat' && (
            <div className="p-3">
              <h4>Chat</h4>
                <Chat xmtpClient={xmtpClient} targetAddress={currentChatAddress} />
            </div>
          )}

          {/* Condition: selectedMenu === 'Profile' */}
          {selectedMenu === 'Profile' && (
            <UserProfile
              marketplaceContract={marketplaceContract}
              usdcDecimals={usdcDecimals}
              account={account}
              userAddress={selectedProfileAddress}
              setShowDescriptionModal={setShowDescriptionModal}
              onChat={onChat}
              onSelectMenu={setSelectedMenu}
              onSetProfileAddress={setSelectedProfileAddress}
            />
          )}
        </Container>
      )}

      {/* Modals */}
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

      {currentOfferForParticipation && (
        <RequestParticipationModal
          show={showRequestModal}
          onHide={() => {
            setShowRequestModal(false);
            setCurrentOfferForParticipation(null);
          }}
          loading={loading}
          requestParticipation={handleRequestParticipation}
          offerType={currentOfferForParticipation.offerType}
        />
      )}

      {currentOfferForChoosing && (
        <ChooseParticipantModal
          show={showChooseModal}
          onHide={() => {
            setShowChooseModal(false);
            setCurrentOfferForChoosing(null);
            setParticipants([]);
          }}
          participants={participants}
          chooseParticipant={chooseParticipant}
          loading={loadingParticipants}
        />
      )}

      <ConfirmTransactionModal
        show={showConfirmModal}
        onHide={handleConfirmCancel}
        amount={confirmAmount}
        onConfirm={handleConfirmProceed}
        loading={loading}
      />
    </div>
  );
}

export default App;
