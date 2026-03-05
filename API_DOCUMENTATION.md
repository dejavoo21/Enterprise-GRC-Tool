# GRC Tool API Documentation

## Assets API

### Base URL
```
http://localhost:3001/api/v1/assets
```

### Endpoints

#### 1. GET /assets - List All Assets
**Description:** Retrieve all assets with optional filtering

**Query Parameters:**
- `type` (optional): Filter by asset type (application, infrastructure, database, saas, endpoint, data_store, other)
- `criticality` (optional): Filter by criticality (low, medium, high, critical)
- `status` (optional): Filter by status (active, planned, retired)
- `owner` (optional): Filter by owner name (partial match, case-insensitive)

**Example Request:**
```bash
GET /api/v1/assets?criticality=critical&status=active
```

**Response Format:**
```json
{
  "data": [
    {
      "id": "AST-001",
      "workspaceId": "ws-001",
      "name": "Finance ERP System",
      "description": "SAP ERP for financial planning, accounting, and reporting",
      "type": "application",
      "owner": "Sarah Kim",
      "businessUnit": "Finance",
      "criticality": "critical",
      "dataClassification": "Restricted",
      "status": "active",
      "linkedVendorId": "VND-001",
      "createdAt": "2024-01-10T10:00:00Z",
      "updatedAt": "2024-02-15T14:30:00Z"
    }
  ],
  "error": null
}
```

---

#### 2. GET /assets/:id - Get Asset by ID
**Description:** Retrieve a single asset by its ID

**Example Request:**
```bash
GET /api/v1/assets/AST-001
```

**Response Format:**
```json
{
  "data": {
    "id": "AST-001",
    "workspaceId": "ws-001",
    "name": "Finance ERP System",
    "description": "SAP ERP for financial planning, accounting, and reporting",
    "type": "application",
    "owner": "Sarah Kim",
    "businessUnit": "Finance",
    "criticality": "critical",
    "dataClassification": "Restricted",
    "status": "active",
    "linkedVendorId": "VND-001",
    "createdAt": "2024-01-10T10:00:00Z",
    "updatedAt": "2024-02-15T14:30:00Z"
  },
  "error": null
}
```

**Error Response (404):**
```json
{
  "data": null,
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset with ID AST-999 not found"
  }
}
```

---

#### 3. POST /assets - Create New Asset
**Description:** Create a new asset

**Request Body:**
```json
{
  "name": "New Application",
  "description": "Description of the application",
  "type": "application",
  "owner": "John Doe",
  "businessUnit": "IT",
  "criticality": "high",
  "dataClassification": "Confidential",
  "status": "active",
  "linkedVendorId": "VND-001"
}
```

**Required Fields:**
- `name`
- `type`
- `owner`
- `businessUnit`
- `criticality`
- `dataClassification`
- `status`

**Optional Fields:**
- `description`
- `linkedVendorId`

**Response (201):**
```json
{
  "data": {
    "id": "AST-012",
    "workspaceId": "ws-001",
    "name": "New Application",
    "description": "Description of the application",
    "type": "application",
    "owner": "John Doe",
    "businessUnit": "IT",
    "criticality": "high",
    "dataClassification": "Confidential",
    "status": "active",
    "linkedVendorId": "VND-001",
    "createdAt": "2024-02-26T10:00:00Z",
    "updatedAt": "2024-02-26T10:00:00Z"
  },
  "error": null
}
```

**Error Response (400):**
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required fields: name, type, owner, businessUnit, criticality, dataClassification, status"
  }
}
```

---

## Vendors API

### Base URL
```
http://localhost:3001/api/v1/vendors
```

### Endpoints

#### 1. GET /vendors - List All Vendors
**Description:** Retrieve all vendors with optional filtering

**Query Parameters:**
- `riskLevel` (optional): Filter by risk level (low, medium, high, critical)
- `status` (optional): Filter by status (active, onboarding, offboarded)
- `owner` (optional): Filter by owner name (partial match, case-insensitive)

**Example Request:**
```bash
GET /api/v1/vendors?riskLevel=critical&status=active
```

**Response Format:**
```json
{
  "data": [
    {
      "id": "VND-001",
      "workspaceId": "ws-001",
      "name": "SAP SE",
      "category": "Enterprise Software",
      "owner": "Sarah Kim",
      "riskLevel": "high",
      "status": "active",
      "nextReviewDate": "2024-08-15",
      "hasDPA": true,
      "regions": ["EU", "NA"],
      "dataTypesProcessed": ["Financial Data", "Employee Data", "Operational Data"],
      "createdAt": "2023-06-01T10:00:00Z",
      "updatedAt": "2024-02-15T14:30:00Z"
    }
  ],
  "error": null
}
```

---

#### 2. GET /vendors/:id - Get Vendor by ID
**Description:** Retrieve a single vendor by its ID

**Example Request:**
```bash
GET /api/v1/vendors/VND-001
```

**Response Format:**
```json
{
  "data": {
    "id": "VND-001",
    "workspaceId": "ws-001",
    "name": "SAP SE",
    "category": "Enterprise Software",
    "owner": "Sarah Kim",
    "riskLevel": "high",
    "status": "active",
    "nextReviewDate": "2024-08-15",
    "hasDPA": true,
    "regions": ["EU", "NA"],
    "dataTypesProcessed": ["Financial Data", "Employee Data", "Operational Data"],
    "createdAt": "2023-06-01T10:00:00Z",
    "updatedAt": "2024-02-15T14:30:00Z"
  },
  "error": null
}
```

**Error Response (404):**
```json
{
  "data": null,
  "error": {
    "code": "VENDOR_NOT_FOUND",
    "message": "Vendor with ID VND-999 not found"
  }
}
```

---

#### 3. POST /vendors - Create New Vendor
**Description:** Create a new vendor

**Request Body:**
```json
{
  "name": "New Cloud Provider",
  "category": "Cloud Infrastructure",
  "owner": "Mike Ross",
  "riskLevel": "medium",
  "status": "active",
  "nextReviewDate": "2024-08-31",
  "hasDPA": true,
  "regions": ["EU", "NA", "APAC"],
  "dataTypesProcessed": ["Customer Data", "Configuration Data"]
}
```

**Required Fields:**
- `name`
- `category`
- `owner`
- `riskLevel`
- `status`
- `nextReviewDate`

**Optional Fields:**
- `hasDPA` (defaults to false)
- `regions` (defaults to empty array)
- `dataTypesProcessed` (defaults to empty array)

**Response (201):**
```json
{
  "data": {
    "id": "VND-010",
    "workspaceId": "ws-001",
    "name": "New Cloud Provider",
    "category": "Cloud Infrastructure",
    "owner": "Mike Ross",
    "riskLevel": "medium",
    "status": "active",
    "nextReviewDate": "2024-08-31",
    "hasDPA": true,
    "regions": ["EU", "NA", "APAC"],
    "dataTypesProcessed": ["Customer Data", "Configuration Data"],
    "createdAt": "2024-02-26T10:00:00Z",
    "updatedAt": "2024-02-26T10:00:00Z"
  },
  "error": null
}
```

**Error Response (400):**
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required fields: name, category, owner, riskLevel, status, nextReviewDate"
  }
}
```

---

## Data Model Details

### Asset Type Values
- `application` - Software applications
- `infrastructure` - Physical/cloud infrastructure
- `database` - Database systems
- `saas` - Software as a Service
- `endpoint` - User endpoints (desktops, laptops, mobile devices)
- `data_store` - Data storage systems
- `other` - Other asset types

### Asset Criticality Levels
- `low` - Non-critical asset
- `medium` - Important but not critical
- `high` - Highly important to business operations
- `critical` - Essential to business operations

### Asset Status Values
- `active` - Currently in use
- `planned` - Planned for future deployment
- `retired` - No longer in use

### Vendor Risk Levels
- `low` - Low risk vendor
- `medium` - Medium risk vendor
- `high` - High risk vendor
- `critical` - Critical risk vendor

### Vendor Status Values
- `active` - Actively providing services
- `onboarding` - Currently being onboarded
- `offboarded` - No longer providing services

---

## Frontend Integration

### Assets Page Features
- View all assets in a data table
- Filter by criticality level
- Search by asset name
- Create new assets via modal
- Summary cards showing:
  - Total number of assets
  - Number of critical assets
  - Number of active assets
  - Number of planned assets

### Vendors Page Features
- View all vendors in a data table
- Filter by risk level
- Search by vendor name
- Create new vendors via modal
- Summary cards showing:
  - Total number of vendors
  - Number of critical risk vendors
  - Number of active vendors
  - Number of vendors with DPA

### Compliance Evidence Tracker Features
- View control-evidence mapping
- Summary cards showing:
  - Total controls
  - Controls with evidence
  - Total evidence items
  - Average coverage percentage
- Click on control to view associated evidence items
- Visual indicators for evidence status

---

## Example Usage Scenarios

### Scenario 1: Create Critical Asset and Link to Vendor
```bash
# Create a critical SaaS asset linked to Salesforce
POST /api/v1/assets
{
  "name": "Customer Relationship Management",
  "description": "Cloud-based CRM for sales team",
  "type": "saas",
  "owner": "Sales Manager",
  "businessUnit": "Sales",
  "criticality": "critical",
  "dataClassification": "Restricted",
  "status": "active",
  "linkedVendorId": "VND-002"
}
```

### Scenario 2: Update Vendor Risk Assessment
```bash
# List all vendors with critical risk level
GET /api/v1/vendors?riskLevel=critical

# Response will show vendors needing immediate attention
# For example: ADP Corporation (Payroll), EY (Audit)
```

### Scenario 3: Track Asset-Vendor Relationships
```bash
# Get Finance ERP asset
GET /api/v1/assets/AST-001

# Response shows linkedVendorId: "VND-001"

# Get the vendor details
GET /api/v1/vendors/VND-001

# Response shows SAP SE details with risk level and DPA status
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Missing or invalid required fields
- `ASSET_NOT_FOUND` - Asset ID not found
- `VENDOR_NOT_FOUND` - Vendor ID not found
- `FETCH_ASSETS_ERROR` - Server error retrieving assets
- `FETCH_VENDORS_ERROR` - Server error retrieving vendors
- `CREATE_ASSET_ERROR` - Server error creating asset
- `CREATE_VENDOR_ERROR` - Server error creating vendor

---

## Testing Tips

### Using curl or Postman

**Get all assets:**
```bash
curl -X GET "http://localhost:3001/api/v1/assets"
```

**Get critical assets:**
```bash
curl -X GET "http://localhost:3001/api/v1/assets?criticality=critical"
```

**Create a new asset:**
```bash
curl -X POST "http://localhost:3001/api/v1/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Asset",
    "type": "application",
    "owner": "Test User",
    "businessUnit": "Testing",
    "criticality": "high",
    "dataClassification": "Confidential",
    "status": "active"
  }'
```

**Get all critical vendors:**
```bash
curl -X GET "http://localhost:3001/api/v1/vendors?riskLevel=critical"
```
