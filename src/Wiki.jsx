import React, { useEffect, useRef } from 'react';
import { Container, Row, Col, Nav } from 'react-bootstrap';
import mermaid from 'mermaid';

import potentialScenarios from './assets/potential_scenarios.png';

// Initialize Mermaid once at the top level.
// 'securityLevel: "loose"' allows certain HTML elements if needed.
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// A small reusable component that handles Mermaid rendering
function MermaidChart({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // Place the Mermaid text into the div
      containerRef.current.innerHTML = chart;
      // Let Mermaid scan that div and render the SVG
      mermaid.init(undefined, containerRef.current);
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid" />;
}

function Wiki() {
  // Define your Mermaid sequence diagram as a template string:
  const diagramDefinition = `
    sequenceDiagram
    participant Alice as Receiver (Alice)
    participant SC as Palket Contract
    participant Bob as Potential Sender (Bob)

    Alice->>SC: createOfferByReceiver("Need a laptop")
    note right of SC: The contract stores Alice's offer in a "Created" state

    Bob->>SC: requestParticipation(offerId, bidPrice)
    note right of SC: Bob provides a deposit along with his bid

    Alice->>SC: chooseParticipant(offerId, Bob)
    note right of SC: The contract marks Bob as the chosen Sender, <br> and refunds deposits of other participants

    Alice->>SC: finalizeOffer(offerId, Score)
    note right of SC: After receiving the laptop, Alice confirms the exchange <br> and provides a rating for Bob

    SC->>Bob: Transfers the product value + deposit (minus any fees)
    SC->>Alice: Returns her deposit (minus finalize fee)
  `;

  return (
    <Container fluid className="mt-4">
      <Row>
        {/* Side Panel Navigation */}
        <Col md={3}>
          <div className="border rounded p-3 bg-light">
            <h5>Navigate</h5>
            <Nav className="flex-column">
              <Nav.Link href="#introduction">Introduction</Nav.Link>
              <Nav.Link href="#who-is-who">Who Is Receiver & Sender?</Nav.Link>
              <Nav.Link href="#how-it-works">How It Works</Nav.Link>
              <Nav.Link href="#deposits">Deposits</Nav.Link>
              <Nav.Link href="#no-dispute-mechanism">No Dispute Mechanism</Nav.Link>
              <Nav.Link href="#potential-scenarios">Potential Scenarios</Nav.Link>
              <Nav.Link href="#typical-exchange">Typical Exchange</Nav.Link>
              <Nav.Link href="#sender-initiated">Sender-Initiated Exchange</Nav.Link>
              <Nav.Link href="#next-steps">Next Steps</Nav.Link>
            </Nav>
          </div>
        </Col>

        {/* Main Content Area */}
        <Col md={9}>
          <div className="border rounded p-3" style={{ backgroundColor: '#fdfdfd' }}>
            {/* Introduction for Newcomers */}
            <h2 id="introduction">Welcome to Palket</h2>
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

            <h4 id="who-is-who">What type of Pal are you?</h4>
            <h6><strong style={{ color: '#FC343A' }}>Receiver</strong></h6>
            <p>
              The <strong style={{ color: '#FC343A' }}>Receiver</strong> is the Pal who wants to exchange 
              cryptocurrency for a product or service in the real world.
            </p>
            <p>
              If you own cryptocurrencies but do not want to comply with intrusive KYCs 
              or pay high fees to convert your coins to fiat, you are clearly a <strong style={{ color: '#FC343A' }}>Receiver</strong>.
            </p>
            <p>
              As a <strong style={{ color: '#FC343A' }}>Receiver</strong>, you can head to the <strong>Buy</strong> section to:
            </p>
            <ul>
              <li>
                Create a request for a product or service you want. If the item is listed 
                on Amazon, Aliexpress, or any other website, include a link. Once created
                , <strong style={{ color: '#FD9155' }}>Senders</strong> can place bids to fulfill your request. You can choose 
                the bid that best suits your price and the <strong style={{ color: '#FD9155' }}>Sender's</strong> rating.
              </li>
              <li>
                Browse through <strong style={{ color: '#FD9155' }}>Sender</strong> offers and accept any you wish. The 
                price is predefined by the <strong style={{ color: '#FD9155' }}>Sender</strong>.
              </li>
            </ul>

            <h6><strong style={{ color: '#FD9155' }}>Sender</strong></h6>
            <p>
              The <strong style={{ color: '#FD9155' }}>Sender</strong> is the Pal who wants to exchange a product 
              or service for cryptocurrency.
            </p>
            <p>
              If you are a dropshipper looking to extend your business to the blockchain 
              environment, or if you want to sell your own product/service for cryptocurrency, 
              you are most likely a <strong style={{ color: '#FD9155' }}>Sender</strong>.
            </p>
            <ul>
              <li>
                Create an offer for any product or service you want to sell. If it’s listed 
                on Amazon, Aliexpress, or another site, feel free to link to the product page. 
                You will predefine the price.
              </li>
              <li>
                Browse through <strong style={{ color: '#FC343A' }}>Receiver</strong> requests and place bids on any 
                that you can fulfill (or dropship).
              </li>
            </ul>

            {/* How It Works */}
            <h4 id="how-it-works">How It Works (Short Overview)</h4>
            <ol>
              <li>
                <strong>Offer Creation:</strong> A Pal creates an offer describing the product 
                or service. 
                <ul>
                  <li>
                    If the Pal is a <strong style={{ color: '#FD9155' }}>Sender</strong>, they lock a deposit of 
                    50% of the offer’s price. The offer state is <em>Created</em>.
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
                    If a <strong style={{ color: '#FD9155' }}>Sender</strong> places a bid, they must lock a deposit of 50% 
                    of the bid price.
                  </li>
                  <li>
                    If a <strong style={{ color: '#FC343A' }}>Receiver</strong> wants to accept an offer, they lock 100% of 
                    the product/service cost + 49% deposit + 1% fee (total 150% of the offer price). 
                  </li>
                </ul>
                The offer is then marked as <em>Accepted</em>.
              </li>
              <li>
                <strong>Choosing a Participant (Receiver-Initiated Offers Only):</strong> 
                For offers created by a <strong style={{ color: '#FC343A' }}>Receiver</strong>, there is an extra step to select 
                the preferred bid. After the selection, the <strong style={{ color: '#FC343A' }}>Receiver</strong> locks the total 
                of 150% (price + 49% deposit + 1% fee). Other bidders get refunded automatically, and 
                the offer is marked <em>Accepted</em>.
              </li>
              <li>
                <strong>Finalization:</strong> The <strong style={{ color: '#FC343A' }}>Receiver</strong> finalizes the offer, 
                unlocking funds in the smart contract. 
                <ul>
                  <li>
                    The <strong style={{ color: '#FC343A' }}>Receiver</strong> recovers their 49% deposit (minus fees).
                  </li>
                  <li>
                    The <strong style={{ color: '#FD9155' }}>Sender</strong> receives the product/service cost + their 50% deposit 
                    (minus fees).
                  </li>
                </ul>
              </li>
              <li>
                <strong>Lottery (Forfeiture):</strong> If an offer remains <em>Accepted</em> 
                for over 180 days, anyone can trigger a forfeiture:
                <ul>
                  <li>
                    10% of the locked money goes to the user triggering the lottery.
                  </li>
                  <li>
                    10% goes to the contract creator.
                  </li>
                  <li>
                    80% goes to a randomly selected Pal who has interacted with Palket.
                  </li>
                </ul>
              </li>
            </ol>

            {/* Deposits */}
            <h4 id="deposits">Deposits</h4>
            <p>
              Deposits ensure both parties have “skin in the game,” reducing dishonest 
              or careless behavior:
            </p>
            <ul>
              <li>
                <strong>Receiver’s deposit:</strong> Motivates the <strong style={{ color: '#FC343A' }}>Receiver</strong> to finalize honestly. 
                Otherwise, they could avoid finalizing even if they received the product/service.
              </li>
              <li>
                <strong>Sender’s deposit:</strong> Ensures the <strong style={{ color: '#FD9155' }}>Sender</strong> will not walk away 
                without delivering the product/service.
              </li>
            </ul>

            {/* No Dispute Mechanism */}
            <h4 id="no-dispute-mechanism">No Dispute Mechanism</h4>
            <p>
              Palket doesn’t include on-chain arbitration. Since real-world deliveries 
              are hard to verify on-chain, the system relies on deposits, fees, and user 
              ratings to incentivize fair dealings.
            </p>

            {/* Potential Scenarios */}
            <h4 id="potential-scenarios">Potential Scenarios</h4>
            <p>
              This diagram shows all the possible scenarios that may occur during interactions 
              with the smart contract. It illustrates how fees align Pal interests so that 
              both parties are incentivized to avoid losing money. The green arrows represent 
              the expected, successful path where both Pals emerge without a loss.
            </p>
            <p>
              <img
                src={potentialScenarios}
                alt="Decision Tree"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </p>

            {/* Typical Exchange (Receiver-Initiated) */}
            <h4 id="typical-exchange">Typical Exchange (Receiver-Initiated Example)</h4>
            <p>
              Below is a sequence diagram showing a Receiver-initiated offer. 
              Alice needs a laptop, and Bob offers one.
            </p>

            {/* Use the MermaidChart component with the diagramDefinition */}
            <MermaidChart chart={diagramDefinition} />

            <h5>Walkthrough:</h5>
            <ol>
              <li>
                <strong>Alice Creates an Offer:</strong> The offer is in “Created” state.
              </li>
              <li>
                <strong>Bob Requests Participation:</strong> Bob locks a 50% deposit with his bid.
              </li>
              <li>
                <strong>Alice Chooses Bob:</strong> The offer is marked “Accepted,” and 
                other participants are refunded.
              </li>
              <li>
                <strong>Finalization:</strong> Alice confirms receipt of the laptop and rates Bob.
              </li>
              <li>
                <strong>Distribution:</strong> Bob receives the product value + deposit (minus fees); 
                Alice’s deposit is returned (minus fees).
              </li>
            </ol>

            {/* Sender-Initiated Exchange */}
            <h4 id="sender-initiated">Sender-Initiated Exchange (High-Level)</h4>
            <p>
              When a <strong style={{ color: '#FD9155' }}>Sender</strong> creates an offer, they lock a deposit of 50% of the offer price. 
              Potential Receivers each lock the item value + a deposit (totaling 150%). 
              The <strong style={{ color: '#FD9155' }}>Sender</strong> then chooses one Receiver, and the flow continues similarly with 
              finalization and fund distribution.
            </p>

            {/* Enhancement / Next Steps */}
            <h4 id="next-steps">Next Steps</h4>
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
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Wiki;
