# IncentivePro Industrial Workflow: Separation of Duties

The IncentivePro system is engineered with a strict multi-tier approval workflow to ensure financial integrity and prevent unauthorized disbursements.

## 🏛️ Administrator (The Final Approver)
**Purpose:** Acting as the ultimate fiscal gatekeeper and personnel manager.
- **Workflow Power:** receives batches from Managers. They are the **ONLY** users with "Final Approval" authority.
- **Primary Responsibility:** Review "Pending" batches for policy compliance.
- **Trigger Power:** Clicking **"Approve"** immediately triggers the **Industrial Mass-Email Notification** to all salespeople in that batch.
- **User Management**: Maintains sovereign control over the creation/editing of Managers, Accounts, and Admins.

### 2. Team Manager (`manager`)
- **Operational Gateway**: Acts as the primary auditor for team performance.
- **Compliance Review**: Must 'Approve' or 'Reject' every deal logged by a specialist.
- **Treasury Preparation**: Consolidation of 'Earned' (verified) deals into financial batches.
- **Sovereign Management**: Full control over **User Management** (Team) and **Incentive Schemes**.
- **Scheme Engineering**: Can define complex rules including Quantity Accelerators and Volume Tiers.
- **Submission Authority:** Groups team performance logs into a Batch and must **"Submit to Admin"** for the next stage.
- **Execution Mirror:** Can log sales on behalf of any team member or themselves.

## 📊 Accounts (The Financial Guardian)
**Purpose:** Secure disbursement of approved capital.
- **Workflow View:** They **ONLY** see batches *after* the Administrator has granted final approval.
- **Disbursement Power:** Once approved, they execute the physical payment and mark the batch as **"Paid"** in the system.
- **Reporting Sovereignty:** Primary role in downloading settlement reports and historical payout logs.

## 🚀 Salesperson (The Performer)
**Purpose:** Real-time visibility of earnings.
- **Visibility:** Receives an automated email the moment the Admin approves their commission.
- **Transparency:** Can track if their sale is "Earned" (logged), "Accrued" (in manager's batch), or "Approved" (waiting for accounts).

---

## The Industrial Flow-chart:
1.  **Sales / Manager** logs a deal ($10k) → Status: `Earned`.
2.  **Manager** groups deals into a Batch and clicks **"Submit for Approval"** → Status: `Pending Admin`.
3.  **Administrator** reviews and clicks **"Grant Final Approval"**:
    *   Status shifts to `Approved`.
    *   **AUTOMATED EMAIL** sent to all Salespeople.
    *   **ACCOUNTS** notified for disbursement.
4.  **Accounts** processes payment and clicks **"Mark Paid"** → Status: `Paid`.
