import React from 'react';

function LiabilityWaiver({ accepted, onChange }) {
  return (
    <>
      <div className="waiver-text">
        <h3>SAUNA MAN LIABILITY WAIVER AND RELEASE</h3>
        <p>By signing this waiver, I acknowledge that I am voluntarily participating in sauna sessions provided by Sauna Man.</p>
        <p>I understand that sauna use involves exposure to high temperatures and may pose health risks including but not limited to: dehydration, heat exhaustion, dizziness, fainting, and cardiovascular stress.</p>
        <p>I confirm that I am in good physical health and have no medical conditions that would prevent me from safely using a sauna. I have consulted with my physician if I have any concerns about my ability to participate.</p>
        <p>I agree to follow all posted rules and guidelines, including time limits and hydration recommendations.</p>
        <p>I hereby release Sauna Man, its owners, operators, employees, and agents from any and all liability, claims, demands, or causes of action arising from my participation in sauna sessions.</p>
        <p>I understand that this waiver is binding and applies to all current and future visits.</p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => onChange(e.target.checked)}
        />
        I have read and agree to the liability waiver
      </label>
    </>
  );
}

export default LiabilityWaiver;
