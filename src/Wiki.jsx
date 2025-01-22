// src/Wiki.jsx

import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Nav, Modal, Button } from 'react-bootstrap';
import mermaid from 'mermaid';
import './Wiki.css'; // Import the CSS file

import potentialScenarios from './assets/potential_scenarios.png';

// Initialize Mermaid once at the top level.
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Reusable MermaidChart component
function MermaidChart({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = chart;
        mermaid.init(undefined, containerRef.current);
      } catch (error) {
        console.error('Mermaid diagram error:', error);
        containerRef.current.innerHTML = '<pre>Error rendering diagram. Please check the syntax.</pre>';
      }
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid" />;
}

// ImageModal component for zooming in on images
function ImageModal({ show, handleClose, src, alt }) {
  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{alt}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        <img src={src} alt={alt} className="img-fluid" />
      </Modal.Body>
    </Modal>
  );
}

function Wiki({ setSelectedMenu }) {
  // State for Image Modal
  const [modalShow, setModalShow] = useState(false);

  // Corrected Mermaid sequence diagram with single quotes
  const diagramDefinition = `
    sequenceDiagram
      participant Alice as Receiver (Alice)
      participant SC as Palket Contract
      participant Bob as Sender (Bob)
      participant Charlie as Potential Sender (Charlie)

      Alice->>SC: createOfferByReceiver("Need this laptop https://amazon.com/laptop")
      activate SC
      SC->>SC: Offer's state updated to "Created"
      deactivate SC

      Bob->>SC: requestParticipation(AliceOffer, 1000)
      activate SC
      SC->>Bob: Request transfer of 500 USDC
      activate Bob
      Bob->>SC: Transfer 500 USDC
      deactivate Bob
      deactivate SC

      Charlie->>SC: requestParticipation(AliceOffer, 990)
      activate SC
      SC->>Charlie: Request transfer of 495 USDC
      activate Charlie
      Charlie->>SC: Transfer 495 USDC
      deactivate Charlie
      deactivate SC

      Alice->>SC: chooseParticipant(AliceOffer, BobAddress)
      activate SC
      SC->>Alice: Request transfer of 1500 USDC
      activate Alice
      Alice->>SC: Transfer 1500 USDC
      deactivate Alice
      SC->>Charlie: Transfer 495 USDC
      SC->>SC: Offer's state updated to "Accepted"
      deactivate SC

      Bob->>Alice: Computer

      Alice->>SC: finalizeOffer(AliceOffer, 5stars)
      activate SC
      SC->>Bob: Transfer 1500 USDC
      SC->>Alice: Transfer 490 USDC
      SC->>SC: Offer's state updated to "Finalized"
      deactivate SC

  `;

  return (
    <Container fluid className="mt-4">
      <Row>
        {/* Side Panel Navigation */}
        <Col md={3}>
          <div className="border-rounded p-3 bg-light-custom">
            <h5>Navigate</h5>
            <Nav className="flex-column">
              <Nav.Link href="#introduction">Introduction</Nav.Link>
              <Nav.Link href="#who-is-who">Who Is Receiver & Sender?</Nav.Link>
              <Nav.Link href="#how-it-works">How It Works &amp; Typical Exchange</Nav.Link>
              <Nav.Link href="#security-arbitration">Security &amp; Arbitration</Nav.Link>
              <Nav.Link href="#next-steps">Next Steps</Nav.Link>
            </Nav>
          </div>
        </Col>

        {/* Main Content Area */}
        <Col md={9}>
          <div className="border-rounded p-3 bg-white-custom">
            {/* Introduction for Newcomers */}
            <section id="introduction">
              <h2>Welcome to Palket</h2>
              <p>
                <strong>Palket</strong> is a decentralized market that connects pals
                (anonymous users, no KYC required) and allows them to exchange cryptocurrencies 
                for goods or services.
              </p>
              <p>
                Palket is based on a smart contract that acts as an escrow and enables 
                on-chain transactions in a secure, trust-minimized way. By leveraging 
                <em> deposits</em> and a <em>rating system</em>, Palket encourages 
                every Pal to act honestly.
              </p>
            </section>

            {/* Who Is Who */}
            <section id="who-is-who">
              <h4>What type of Pal are you?</h4>

              <div className="mb-4">
                <h5 className="text-receiver">Receiver</h5>
                <p>
                  The <strong className="text-receiver">Receiver</strong> is the Pal who wants to exchange 
                  cryptocurrency for a product or service in the real world.
                </p>
                <p>
                  If you own cryptocurrencies but do not want to comply with intrusive KYCs 
                  or pay high fees to convert your coins to fiat, you are clearly a <strong className="text-receiver">Receiver</strong>.
                </p>
                <p>
                  As a <strong className="text-receiver">Receiver</strong>, you can head to the{' '}
                  <Button variant="link" onClick={() => setSelectedMenu('Buy')} className="p-0">
                    <strong>Buy</strong>
                  </Button>{' '}
                  section to:
                </p>
                <ul>
                  <li>
                    Create a request for a product or service you want. If the item is listed 
                    on Amazon, Aliexpress, or any other website, include a link. Once created,
                    <strong className="text-sender"> Senders</strong> can place bids to fulfill your request. You can choose 
                    the bid that best suits your price and the <strong className="text-sender">Sender's</strong> rating.
                  </li>
                  <li>
                    Browse through <strong className="text-sender">Sender</strong> offers and accept any you wish. The 
                    price is predefined by the <strong className="text-sender">Sender</strong>.
                  </li>
                </ul>
              </div>

              <div className="mb-4">
                <h5 className="text-sender">Sender</h5>
                <p>
                  The <strong className="text-sender">Sender</strong> is the Pal who wants to exchange a product 
                  or service for cryptocurrency.
                </p>
                <p>
                  If you are a dropshipper looking to extend your business to the blockchain 
                  environment, or if you want to sell your own product/service for cryptocurrency, 
                  you are most likely a <strong className="text-sender">Sender</strong>.
                </p>
                <p>
                  As a <strong className="text-sender">Sender</strong>, you can head to the{' '}
                  <Button variant="link" onClick={() => setSelectedMenu('Sell')} className="p-0">
                    <strong>Sell</strong>
                  </Button>{' '}
                  section to:
                </p>
                <ul>
                  <li>
                    Create an offer for any product or service you want to sell. If it’s listed 
                    on Amazon, Aliexpress, or another site, feel free to link to the product page. 
                    You will predefine the price.
                  </li>
                  <li>
                    Browse through <strong className="text-receiver">Receiver</strong> requests and place bids on any 
                    that you can fulfill (or dropship).
                  </li>
                </ul>
              </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works">
              <h4>How It Works</h4>
              <p>
                Below is both a short overview of how the Palket process typically unfolds 
                and a specific, Receiver-initiated example illustrating the steps in detail.
              </p>

              <ol>
                <li>
                  <strong>Offer Creation:</strong> A Pal creates an offer describing the product 
                  or service.
                  <ul>
                    <li>
                      <strong className="text-receiver">Receiver</strong><strong>-Initiated Offers</strong>. If the Pal is a <strong className="text-receiver">Receiver</strong>, they do not need to
                      lock any money, since the price will come from the bids. The offer state is <em>Created</em>.
                    </li>
                    <li>
                      <strong className="text-sender">Sender</strong><strong>-Initiated Offers</strong>. If the Pal is a <strong className="text-sender">Sender</strong>, they lock a deposit of 
                      50% of the offer’s price. The offer state is <em>Created</em>.
                    </li>
                    <li>
                      For example, if Alice wants to buy a laptop from Amazon, she can create an offer with 
                      the following description "Need this laptop https://amazon.com/laptop". Since she is
                      a <strong className="text-receiver">Receiver</strong>, she does not lock any money yet.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>Canceling:</strong> The offer can be canceled by the creator at any time 
                  while it is still in <em>Created</em> state. The locked amount is returned (if any), 
                  and the offer state changes to <em>Cancelled</em>.
                </li>

                <li>
                  <strong>Participation Requests:</strong> The opposite role can request to participate.
                  <ul>
                    <li>
                      <strong className="text-receiver">Receiver</strong><strong>-Initiated Offers</strong>. If a <strong className="text-sender">Sender</strong> places a bid, they must lock a deposit of 50% 
                      of the bid price. The offer is then marked as <em>Accepted</em>.
                    </li>
                    <li>
                      <strong className="text-sender">Sender</strong><strong>-Initiated Offers</strong>. If a <strong className="text-receiver">Receiver</strong> wants to accept an offer, they lock 100% of 
                      the product/service cost + 49% deposit + 1% fee (totaling 150% of the offer price).
                      The offer is then marked as <em>Accepted</em>.
                    </li>
                    <li>
                      For example, Bob may see Alice's offer, check that the Amazon product from the link 
                      is selling for $950 and requests to participate by placing a bid of $1000 for a profit of $50.
                      When placing the bid, Bob will need to lock a deposit of $500.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>Choosing a Participant:</strong> 
                  <ul>
                    <li>
                      <strong className="text-receiver">Receiver</strong><strong>-Initiated Offers</strong>. There is an extra step to select the preferred bid.
                      After the selection, the <strong className="text-receiver">Receiver</strong> locks the total 
                      of 150% (100% price + 49% deposit + 1% fee). Other bidders get refunded automatically, and 
                      the offer is marked <em>Accepted</em>.
                    </li>
                    <li>
                      <strong className="text-sender">Sender</strong><strong>-Initiated Offers</strong>. When a <strong className="text-receiver">Receiver</strong> accepts
                      <strong className="text-sender">Sender</strong> offer, the offer is automatically <em>Accepted</em>, so the <strong className="text-sender">Sender</strong> does
                      not need to accept any bid.
                      50% of the offer’s price. The offer state is <em>Created</em>.
                    </li>
                    <li>
                      In the example, Alice reviews the bids and sees that Bob's bid is not the cheapest, but Bob 
                      has a record of successful trades and a score of 4.5/5.0. She finali decides to choose him 
                      as the participant. She then locks the total of 150% ($1500). Any other participants are refunded, 
                      and the offer state is updated to <em>Accepted</em>.
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>Finalization:</strong> The <strong className="text-receiver">Receiver</strong> finalizes the offer, 
                  unlocking funds in the smart contract.
                  <ul>
                    <li>
                      The <strong className="text-receiver">Receiver</strong> recovers their 49% deposit.
                    </li>
                    <li>
                      The <strong className="text-sender">Sender</strong> receives the product/service cost + their 50% deposit.
                    </li>
                    <li>
                      In the example, after receiving the laptop from Bob, Alice confirms the exchange and provides a rating for Bob. The smart contract then:
                      <ul>
                        <li>Returns Alice's deposit ($490)</li>
                        <li>Transfers the product value ($1000) + Bob's deposit ($500) to Bob</li>
                      </ul>
                    </li>
                  </ul>
                </li>

                <li>
                  <strong>Lottery (Forfeiture):</strong> If an offer remains <em>Accepted</em> for
                  over 180 days, anyone can trigger a forfeiture:
                  <ul>
                    <li>10% of the locked money goes to the user triggering the lottery.</li>
                    <li>10% goes to the contract creator.</li>
                    <li>80% goes to a randomly selected Pal who has interacted with Palket.</li>
                  </ul>
                </li>
              </ol>

              <p>
                Below is a sequence diagram illustrating the Receiver-initiated exchange between Alice and Bob.
              </p>
              <MermaidChart chart={diagramDefinition} />
            </section>

            {/* Security & Arbitration */}
            <section id="security-arbitration">
              <h4>Security &amp; Arbitration</h4>
              <div className="mb-4">
                <h5>Deposits</h5>
                <p>
                  Deposits ensure both parties have “skin in the game,” reducing dishonest 
                  or careless behavior:
                </p>
                <ul>
                  <li>
                    <strong>Receiver’s deposit:</strong> Motivates the <strong className="text-receiver">Receiver</strong> to finalize honestly. 
                    Otherwise, they could avoid finalizing even if they received the product/service.
                  </li>
                  <li>
                    <strong>Sender’s deposit:</strong> Ensures the <strong className="text-sender">Sender</strong> will not walk away 
                    without delivering the product/service.
                  </li>
                </ul>
              </div>

              <div className="mb-4">
                <h5>No Dispute Mechanism</h5>
                <p>
                  Palket doesn’t include on-chain arbitration. Since real-world deliveries 
                  are hard to verify on-chain, the system relies on deposits, fees, and user 
                  ratings to incentivize fair dealings.
                </p>
              </div>
            </section>

            {/* Potential Scenarios */}
            <div className="mb-4">
              <h4>Potential Scenarios</h4>
              <p>
                This diagram shows all the possible scenarios that may occur during interactions 
                with the smart contract. It illustrates how fees align Pal interests so that 
                both parties are incentivized to avoid losing money. The green arrows represent 
                the expected, successful path where both Pals emerge without a loss.
              </p>
              <div className="image-container">
                <img
                  src={potentialScenarios}
                  alt="Decision Tree"
                  className="img-fluid scenario-image"
                  onClick={() => setModalShow(true)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <ImageModal
                show={modalShow}
                handleClose={() => setModalShow(false)}
                src={potentialScenarios}
                alt="Potential Scenarios"
              />
            </div>

            {/* Next Steps */}
            <section id="next-steps">
              <h4>Next Steps</h4>
              <p>
                Here are a few suggestions to enhance your experience on Palket:
              </p>
              <ul>
                <li>
                  <strong>Create a Test Offer:</strong> Try walking through the process with 
                  a small deposit to understand the mechanics before committing to larger transactions.
                </li>
                <li>
                  <strong>Explore Ratings &amp; Reviews:</strong> Check how user ratings reflect 
                  reliability. A user with a good track record is generally more trustworthy.
                </li>
                <li>
                  <strong>Review the Smart Contract Code:</strong> If you're tech-savvy, 
                  examine the Solidity code to confirm how fees, deposits, and forfeiting are handled.
                </li>
              </ul>
            </section>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Wiki;
