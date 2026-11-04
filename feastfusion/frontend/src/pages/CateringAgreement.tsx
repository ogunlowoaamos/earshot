import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import './CateringAgreement.css'

function Row({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="agreement__row">
      <span className="agreement__label">{label}</span>
      <span className="agreement__value">
        {children ?? <span className="agreement__line" />}
      </span>
    </div>
  )
}

function Box({ children }: { children: ReactNode }) {
  return <span className="agreement__box">{children}</span>
}

export function CateringAgreement() {
  return (
    <div className="agreement-page">
      <div className="agreement-page__bar no-print">
        <Link to="/catering" className="btn btn--ghost btn--sm">
          ← Back to catering
        </Link>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => window.print()}
        >
          Print or save as PDF
        </button>
      </div>

      <article className="agreement">
        <header className="agreement__head">
          <p className="agreement__brand">FeastFusion Kitchen</p>
          <h1>Catering Booking &amp; Non-Refundable Deposit Agreement</h1>
          <p className="agreement__meta">
            Please read this in full. Clause 4 explains that your booking deposit is not
            refundable. Initial clause 4 before signing.
          </p>
        </header>

        <section className="agreement__summary">
          <h2>In plain language</h2>
          <ol>
            <li>You pay a booking deposit to lock your date.</li>
            <li>
              <strong>That deposit is not refundable.</strong> If you cancel, for any reason, you do
              not get it back.
            </li>
            <li>
              If the event goes ahead, the deposit comes off your final bill. You only lose
              it if you cancel.
            </li>
            <li>If <em>we</em> cancel, you get it back in full.</li>
          </ol>
        </section>

        <section>
          <h2>Parties</h2>
          <h3>FeastFusion Kitchen (“FeastFusion”, “we”, “us”)</h3>
          <Row label="Business address" />
          <Row label="Phone / WhatsApp" />
          <Row label="Email" />
          <Row label="Bank details for deposit" />
          <h3>The Client (“you”)</h3>
          <Row label="Full name" />
          <Row label="Phone / WhatsApp" />
          <Row label="Email" />
          <Row label="Address" />
        </section>

        <section>
          <h2>1. The Event</h2>
          <Row label="Event type">
            <Box>Wedding</Box> <Box>Birthday</Box> <Box>Corporate</Box>{' '}
            <Box>Memorial</Box> <Box>Other</Box>
          </Row>
          <Row label="Event date" />
          <Row label="Guest arrival time" />
          <Row label="Food service time" />
          <Row label="Venue name" />
          <Row label="Venue address" />
          <Row label="Confirmed guest count" />
          <Row label="Service style">
            <Box>Buffet</Box> <Box>Plated</Box> <Box>Family style</Box>{' '}
            <Box>Small chops only</Box>
          </Row>
        </section>

        <section>
          <h2>2. What FeastFusion will provide</h2>
          <p>
            The menu, quantities and per-head price agreed in writing (by email or WhatsApp)
            form part of this agreement as <strong>Schedule A</strong>.
          </p>
          <p className="agreement__checks">
            <Box>Food as per Schedule A</Box>
            <Box>Serving staff, number: ____</Box>
            <Box>Chafing dishes / warmers</Box>
            <Box>Plates, cutlery, serviettes</Box>
            <Box>Drinks, specify: __________</Box>
            <Box>Other: __________</Box>
          </p>
          <p className="agreement__small">
            Anything not ticked above is not included in the price.
          </p>
        </section>

        <section>
          <h2>3. Price and booking deposit</h2>
          <Row label="Total agreed price">₦ ____________________</Row>
          <Row label="Booking deposit payable on signing">
            <strong>₦ ____________________</strong>
          </Row>
          <Row label="Balance due before the event">₦ ____________________</Row>
          <p>
            <strong>Deposit due:</strong> on signing, cleared funds only. Your date is not
            held until the deposit has cleared, and FeastFusion may continue to offer the
            date to other clients until then.
          </p>
        </section>

        <section className="agreement__clause agreement__clause--key">
          <h2>4. The deposit is non-refundable</h2>
          <p>
            <strong>4.1</strong> The booking deposit is{' '}
            <strong>non-refundable in every circumstance</strong>, with the single exception
            in clause 8 (where FeastFusion cancels).
          </p>
          <p>
            <strong>4.2</strong> The deposit is a <strong>commitment fee</strong>, not
            payment for work already performed. By accepting it, FeastFusion (a) holds your
            date exclusively and turns away other enquiries for that date, (b) begins
            purchasing ingredients, booking staff and committing funds to your event, and (c)
            loses the ability to earn from that date if you withdraw.
          </p>
          <p>
            <strong>4.3</strong> If you cancel for <strong>any</strong> reason (including change of
            mind, change of date, venue problems, a reduced guest count, illness, bereavement,
            weather, travel difficulty, or the event simply not holding),{' '}
            <strong>the deposit is retained by FeastFusion in full.</strong> No part of it is
            returned.
          </p>
          <p>
            <strong>4.4</strong> If the event proceeds as agreed, the deposit is credited{' '}
            <strong>in full</strong> against your final invoice. Where the event goes ahead,
            the deposit is not money lost.
          </p>
          <p>
            <strong>4.5</strong> The deposit is not transferable to another person or another
            event, except under clause 7.
          </p>
          <p className="agreement__initial">
            Client’s initials confirming you have read and accept clause 4:{' '}
            <span className="agreement__line agreement__line--short" />
          </p>
        </section>

        <section>
          <h2>5. Balance payment</h2>
          <p>
            <strong>5.1</strong> The balance is payable no later than{' '}
            <strong>7 days before the event</strong>, unless a different date is written
            here: ______________________.
          </p>
          <p>
            <strong>5.2</strong> Final guest numbers must be confirmed at the same time as
            the balance.
          </p>
          <p>
            <strong>5.3</strong> If the balance is not paid by the due date, FeastFusion may
            treat the booking as cancelled by you. Clause 4 then applies and the deposit is
            retained.
          </p>
        </section>

        <section>
          <h2>6. Changes to guest numbers</h2>
          <p>
            <strong>6.1 Increases</strong> are accepted up to <strong>7 days</strong> before
            the event, subject to kitchen capacity, at the agreed per-head rate.
          </p>
          <p>
            <strong>6.2 Decreases</strong> made 7 days or more before the event reduce the
            price to the new confirmed count.
          </p>
          <p>
            <strong>6.3 Decreases</strong> made within 7 days of the event{' '}
            <strong>do not reduce the price.</strong> You pay for the higher of the confirmed
            count and the final count, because ingredients and staff are already committed.
          </p>
        </section>

        <section>
          <h2>7. Rescheduling</h2>
          <p>
            <strong>7.1</strong> You may reschedule <strong>once</strong>, free of charge, if
            you give written notice <strong>at least 21 days</strong> before the event, and
            only to a date FeastFusion can still serve and within{' '}
            <strong>6 months</strong> of the original date. Your deposit carries over.
          </p>
          <p>
            <strong>7.2</strong> A second reschedule is treated as a cancellation. Clause 4
            applies.
          </p>
          <p>
            <strong>7.3</strong> Notice given less than 21 days before the event is treated as
            a cancellation. Clause 4 applies.
          </p>
        </section>

        <section>
          <h2>8. If FeastFusion cancels</h2>
          <p>
            <strong>8.1</strong> If FeastFusion cancels for any reason within our control,
            you may choose either a <strong>full refund</strong> of the deposit within 14
            days, or the deposit carried over to a new date we both agree.
          </p>
          <p>
            <strong>8.2</strong> If FeastFusion cannot perform because of an event outside
            our control (fire, flood, civil unrest, government restriction, sudden serious
            illness of key staff, or similar), you may choose either the deposit carried over
            to a new date we both agree, or a <strong>full refund</strong> less only amounts
            already paid to third parties specifically for your event, evidenced with
            receipts.
          </p>
          <p>
            <strong>8.3</strong> Clause 8 is the <strong>only</strong> situation in which any
            part of the deposit is returned.
          </p>
        </section>

        <section>
          <h2>9. Menu and dietary requirements</h2>
          <p>
            <strong>9.1</strong> The final menu is locked <strong>14 days</strong> before the
            event. After that, no substitutions.
          </p>
          <p>
            <strong>9.2</strong> All allergies, intolerances and dietary requirements must be
            given to FeastFusion <strong>in writing</strong> at least 14 days before the
            event.
          </p>
          <p>
            <strong>9.3</strong> FeastFusion prepares food in a kitchen that also handles
            peanuts, tree nuts, shellfish, fish, eggs, milk, wheat and soya.{' '}
            <strong>We cannot guarantee an allergen-free dish.</strong>
          </p>
        </section>

        <section>
          <h2>10. Venue, access and logistics</h2>
          <p>
            <strong>10.1</strong> You will give our team access to the venue{' '}
            <strong>at least 3 hours</strong> before service, plus a safe, clean space to set
            up.
          </p>
          <p>
            <strong>10.2</strong> You will provide running water, electricity and reasonable
            security for our staff and equipment.
          </p>
          <p>
            <strong>10.3</strong> If the venue is not ready on time or access is delayed
            through no fault of FeastFusion, waiting time is charged at{' '}
            <strong>₦ __________ per hour</strong>, payable on the day.
          </p>
          <p>
            <strong>10.4</strong> Any venue fee, corkage, power levy or permit charged by the
            venue is your responsibility.
          </p>
        </section>

        <section>
          <h2>11. Food safety and leftovers</h2>
          <p>
            <strong>11.1</strong> Food is served at safe temperatures. Once served, food that
            sits out for <strong>more than 2 hours</strong> is no longer safe to eat and
            FeastFusion accepts no responsibility for it.
          </p>
          <p>
            <strong>11.2</strong> Leftovers are only packed if you supply containers, and only
            if requested before service.
          </p>
          <p>
            <strong>11.3</strong> FeastFusion will not release food to guests before the
            agreed service time.
          </p>
        </section>

        <section>
          <h2>12. Staff and equipment</h2>
          <p>
            <strong>12.1</strong> Our staff will behave professionally. Abuse, threats or
            harassment of our team ends service immediately, with no refund.
          </p>
          <p>
            <strong>12.2</strong> Hired equipment (warmers, dishes) remains FeastFusion
            property and must be returned on the day. Loss or damage caused by you or your
            guests is charged at replacement cost.
          </p>
        </section>

        <section>
          <h2>13. Limitation of liability</h2>
          <p>
            <strong>13.1</strong> FeastFusion’s total liability under this agreement is
            limited to the <strong>total amount you have paid us</strong>.
          </p>
          <p>
            <strong>13.2</strong> FeastFusion is not liable for indirect or consequential
            losses, including lost profits, or for delays caused by traffic, weather, road
            closures or other events outside our reasonable control.
          </p>
          <p>
            <strong>13.3</strong> Nothing in this clause limits liability for death or
            personal injury caused by our negligence, or for fraud.
          </p>
        </section>

        <section>
          <h2>14. Photography</h2>
          <p>
            FeastFusion may photograph the food we prepare for our portfolio and social
            media. Tick if you object: <Box>I object. Please do not photograph my event</Box>
          </p>
        </section>

        <section>
          <h2>15. Governing law and disputes</h2>
          <p>
            <strong>15.1</strong> This agreement is governed by the laws of the{' '}
            <strong>Federal Republic of Nigeria</strong>.
          </p>
          <p>
            <strong>15.2</strong> If a dispute arises, both parties will first try to resolve
            it amicably within <strong>14 days</strong> of written notice, including by a
            phone or in-person meeting.
          </p>
          <p>
            <strong>15.3</strong> If that fails, the courts of <strong>FCT, Abuja</strong>{' '}
            have exclusive jurisdiction.
          </p>
        </section>

        <section>
          <h2>16. Notices</h2>
          <p>
            Written notice under this agreement is valid if sent by email or WhatsApp to the
            contacts listed on page 1, and is treated as received on the day it is sent (or
            the next working day if sent after 6pm or on a Sunday or public holiday).
          </p>
        </section>

        <section>
          <h2>17. Whole agreement</h2>
          <p>
            <strong>17.1</strong> This agreement, together with Schedule A (agreed menu) and
            our invoice, is the <strong>entire agreement</strong> between us. It replaces
            anything said or written before.
          </p>
          <p>
            <strong>17.2</strong> Changes are only valid if made in writing (including email
            or WhatsApp) and confirmed by both parties.
          </p>
          <p>
            <strong>17.3</strong> If any clause is found unenforceable, the rest of the
            agreement stays in force.
          </p>
          <p>
            <strong>17.4</strong> Signing electronically, or confirming by email or WhatsApp,
            has the same effect as signing by hand.
          </p>
        </section>

        <section className="agreement__sign">
          <h2>18. Signatures</h2>
          <p>
            By signing, you confirm that you have read and understood this agreement,{' '}
            <strong>including the non-refundable deposit in clause 4</strong>, and that you
            have had the chance to ask questions about it.
          </p>

          <div className="agreement__sig-grid">
            <div>
              <h3>The Client</h3>
              <Row label="Signature" />
              <Row label="Full name" />
              <Row label="Date" />
            </div>
            <div>
              <h3>For FeastFusion Kitchen</h3>
              <Row label="Signature" />
              <Row label="Full name" />
              <Row label="Title" />
              <Row label="Date" />
            </div>
          </div>

          <div className="agreement__sig-grid agreement__sig-grid--single">
            <div>
              <h3>Witness (optional)</h3>
              <Row label="Signature" />
              <Row label="Full name" />
              <Row label="Date" />
            </div>
          </div>
        </section>

        <section className="agreement__schedule">
          <h2>Schedule A: Agreed menu</h2>
          <table className="agreement__table">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Quantity / portions</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
          <Row label="Per-head price">₦ ____________________</Row>
          <Row label="Guests">____________________</Row>
          <Row label="Agreed by (client)" />
          <Row label="Agreed by (FeastFusion)" />
        </section>
      </article>
    </div>
  )
}
