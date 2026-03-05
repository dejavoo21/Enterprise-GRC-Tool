# Quick Start Guide - New GRC Capabilities

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Port 3001 (backend) and 5174 (frontend) available

---

## Starting the Application

### 1. Start the Backend Server

```bash
cd grc-tool/backend
npm run dev
```

Expected output:
```
GRC Backend API running on http://localhost:3001
Health check: http://localhost:3001/health
Assets API: http://localhost:3001/api/v1/assets
Vendors API: http://localhost:3001/api/v1/vendors
```

### 2. Start the Frontend Server

In a new terminal window:
```bash
cd grc-tool/frontend
npm run dev
```

Expected output:
```
VITE v7.3.1  ready in X ms
Local: http://localhost:5174/
```

---

## Accessing the New Features

### Via Web Browser
1. Open http://localhost:5174 in your browser
2. You'll see the GRC Dashboard

### Navigation to New Modules

#### Assets Module
- **Sidebar:** INVENTORY → Assets
- **Direct URL:** http://localhost:5174/#assets
- **Features:**
  - View all organizational assets
  - Filter by criticality level
  - Create new assets
  - Search by asset name

#### Vendors Module
- **Sidebar:** INVENTORY → Vendors
- **Direct URL:** http://localhost:5174/#vendors
- **Features:**
  - Manage third-party vendors
  - Filter by risk level
  - Track review dates
  - Create new vendors
  - DPA tracking

#### Compliance Evidence Tracker
- **Sidebar:** COMPLIANCE & EVIDENCE → Compliance Evidence Tracker
- **Direct URL:** http://localhost:5174/#compliance-tracker
- **Features:**
  - View control-to-evidence mapping
  - Track evidence collection status
  - View details for specific controls
  - Calculate coverage statistics

---

## Testing the APIs

### Using Browser DevTools (Recommended for Quick Testing)

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to Assets or Vendors page
4. Watch API calls in real-time
5. View request/response data

### Using curl

#### Get All Assets
```bash
curl http://localhost:3001/api/v1/assets
```

#### Get Critical Assets
```bash
curl "http://localhost:3001/api/v1/assets?criticality=critical"
```

#### Get Specific Asset
```bash
curl http://localhost:3001/api/v1/assets/AST-001
```

#### Create New Asset
```bash
curl -X POST http://localhost:3001/api/v1/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Asset",
    "type": "application",
    "owner": "John Doe",
    "businessUnit": "IT",
    "criticality": "high",
    "dataClassification": "Confidential",
    "status": "active"
  }'
```

#### Get All Vendors
```bash
curl http://localhost:3001/api/v1/vendors
```

#### Get Critical Vendors
```bash
curl "http://localhost:3001/api/v1/vendors?riskLevel=critical"
```

#### Create New Vendor
```bash
curl -X POST http://localhost:3001/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Vendor",
    "category": "Cloud Provider",
    "owner": "Manager Name",
    "riskLevel": "medium",
    "status": "active",
    "nextReviewDate": "2024-08-31",
    "hasDPA": true,
    "regions": ["EU", "NA"],
    "dataTypesProcessed": ["Customer Data"]
  }'
```

### Using Postman

1. Import endpoints from API_DOCUMENTATION.md
2. Set base URL to http://localhost:3001/api/v1
3. Create requests for each endpoint
4. Save as collection for reuse

---

## Demo Data Available

### Pre-loaded Assets (11 total)
1. Finance ERP System (Critical)
2. Payroll System (Critical)
3. HR Database (High)
4. Corporate File Server (High)
5. Salesforce CRM (High)
6. Microsoft 365 Suite (Critical)
7. Marketing Automation (Medium)
8. Legacy Inventory System (Retired)
9. Customer Data Warehouse (High)
10. Endpoint Security (Critical)
11. Document Repository (Planned)

### Pre-loaded Vendors (9 total)
1. SAP SE (High Risk)
2. Salesforce Inc (Medium Risk)
3. ADP Corporation (Critical Risk)
4. Microsoft Corporation (Medium Risk)
5. HubSpot Inc (Low Risk)
6. CrowdStrike Inc (Medium Risk)
7. Accenture LLP (Medium Risk)
8. EY (Ernst & Young) (Critical Risk)
9. Verizon Enterprise (High Risk)

---

## Common Tasks

### Creating a New Asset

1. Navigate to Assets page
2. Click "New Asset" button
3. Fill in form fields:
   - Name (required)
   - Description (optional)
   - Type (required) - select from dropdown
   - Owner (required)
   - Business Unit (required)
   - Criticality (required)
   - Data Classification (required)
   - Status (required)
4. Click "Create Asset"
5. Asset appears in table immediately

### Creating a New Vendor

1. Navigate to Vendors page
2. Click "New Vendor" button
3. Fill in form fields:
   - Vendor Name (required)
   - Category (required)
   - Owner (required)
   - Risk Level (required)
   - Status (required)
   - Next Review Date (required)
   - Has DPA (checkbox)
   - Regions (comma-separated, optional)
   - Data Types Processed (comma-separated, optional)
4. Click "Create Vendor"
5. Vendor appears in table immediately

### Filtering Assets by Criticality

1. Navigate to Assets page
2. Locate the filter dropdown above the table
3. Select desired criticality level (Low, Medium, High, Critical)
4. Table updates to show only matching assets
5. Select "All" to clear filter

### Filtering Vendors by Risk Level

1. Navigate to Vendors page
2. Locate the filter dropdown above the table
3. Select desired risk level (Low, Medium, High, Critical)
4. Table updates to show only matching vendors
5. Select "All" to clear filter

### Searching for Assets

1. Navigate to Assets page
2. Click in search box
3. Type asset name or partial match
4. Table updates in real-time as you type
5. Clear search box to see all assets

### Tracking Evidence Coverage

1. Navigate to Compliance Evidence Tracker
2. Review summary cards for overview:
   - Total Controls
   - Evidenced Controls
   - Total Evidence Items
   - Coverage Percentage
3. Scroll to Evidence Coverage table
4. Review which controls have evidence (✓) and which don't (✗)
5. Click on any control row to see evidence details
6. Close details panel to return to table

---

## Troubleshooting

### Backend Won't Start
**Error:** "Port 3001 already in use"
- **Solution:** Kill the existing process or use different port
- **Windows:** `netstat -ano | findstr :3001` then `taskkill /PID <PID> /F`

### Frontend Won't Start
**Error:** "Port 5174 already in use"
- **Solution:** Kill existing process or Vite will use next available port
- **Windows:** Check terminal output for actual port being used

### API Calls Failing
**Error:** "Failed to fetch assets"
- **Solution:** Verify backend is running on port 3001
- **Check:** http://localhost:3001/health should show `{"status":"ok"}`

### Type Errors in IDE
**Error:** "Cannot find module '@types/xyz'"
- **Solution:** Run `npm install` in both backend and frontend directories

### Components Not Appearing
**Error:** "Assets/Vendors pages show placeholder"
- **Solution:** Ensure frontend has been recompiled after edits
- **Try:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## Development Tips

### Debugging Frontend

1. Open DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for API calls
4. Use React DevTools extension for component inspection
5. Set breakpoints in Sources tab

### Debugging Backend

1. Add console.log statements in route handlers
2. Check terminal output for logs
3. Use cURL or Postman to test endpoints directly
4. Check for validation errors in responses

### Modifying Data

To modify existing assets/vendors:
1. Edit data in `backend/src/store/index.ts`
2. Restart backend server
3. Frontend will fetch fresh data

---

## Next Steps

### 1. Explore the Features
- Create a few test assets and vendors
- Try different filters and searches
- Check the evidence tracker with existing controls

### 2. Review the Code
- Study the type definitions in `types/asset.ts` and `types/vendor.ts`
- Review API routes in `backend/src/routes/`
- Examine React components in `frontend/src/pages/`

### 3. Extend the Functionality
- Add edit/delete operations
- Implement bulk operations
- Add export to CSV
- Create risk scoring algorithms
- Add advanced filtering

### 4. Database Migration
When ready to persist data:
- Create PostgreSQL schema
- Implement repository layer
- Replace in-memory store with database queries
- Maintain API contracts

---

## File Locations Reference

### Backend Files
- **Types:** `backend/src/types/models.ts`
- **Routes:** `backend/src/routes/assets.ts`, `backend/src/routes/vendors.ts`
- **Store:** `backend/src/store/index.ts`
- **Server:** `backend/src/index.ts`

### Frontend Files
- **Asset Types:** `frontend/src/types/asset.ts`
- **Vendor Types:** `frontend/src/types/vendor.ts`
- **Assets Page:** `frontend/src/pages/Assets.tsx`
- **Vendors Page:** `frontend/src/pages/Vendors.tsx`
- **Evidence Tracker:** `frontend/src/pages/ComplianceEvidenceTracker.tsx`
- **Routing:** `frontend/src/App.tsx`
- **Navigation:** `frontend/src/components/Sidebar.tsx`

### Documentation Files
- **API Docs:** `API_DOCUMENTATION.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **File Structure:** `FILE_STRUCTURE_GUIDE.md`
- **Quick Start:** `QUICK_START.md` (this file)

---

## Support & Resources

### Documentation
- Read `API_DOCUMENTATION.md` for complete API reference
- See `IMPLEMENTATION_SUMMARY.md` for architecture overview
- Check `FILE_STRUCTURE_GUIDE.md` for code organization

### Code Examples
API examples are in `API_DOCUMENTATION.md` with curl commands and JSON payloads

### Error Messages
Check the error `code` and `message` fields in API responses for guidance

---

## Summary

You now have three new fully-functional GRC modules:
1. ✅ **Asset Inventory & Management** - Track organizational assets
2. ✅ **Vendor Management** - Manage third-party risks
3. ✅ **Compliance Evidence Tracker** - Track evidence against controls

All modules are:
- ✅ Fully integrated into the application
- ✅ Type-safe with TypeScript
- ✅ Styled consistently
- ✅ Responsive and user-friendly
- ✅ Ready for database migration

Happy GRC tooling! 🎉
