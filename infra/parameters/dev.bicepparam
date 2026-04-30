using '../main.bicep'

// Resource names
param keyVaultName = 'abti-kv-dev'
param storageAccountName = 'abtiresellerdatadev'
param serviceBusNamespaceName = 'abti-onboarding-pcs-dev'
param dbServerName = 'abti-db-dev'
param appServicePlanName = 'ASP-PCS-ABTI-DEV'
param apiAppName = 'abti-api-dev'
param workerAppName = 'abti-worker-dev'
param staticWebAppName = 'abti-frontend-dev'

// Compute
param appServicePlanSku = 'P0v3'
param staticWebAppSku = 'Free'

// Database
param dbSkuName = 'Standard_B1ms'
param dbSkuTier = 'Burstable'
param geoRedundantBackup = false

// Networking
param vnetResourceGroup = 'RG-PCS-IT-NETWORKING-DEV-EUS2'
param vnetName = 'VNET-PCS-PLATFORM-DEV-EUS2'
param storagePrivateEndpointSubnetName = 'snet-PrivateEndpoint-Storage'
param appServicesSubnetName = 'snet-PrivateEndpoint-AppServices'
param sqlPrivateEndpointSubnetName = 'snet-PrivateEndpoint-SQL'

// Integrations
param docusignBasePath = 'https://demo.docusign.net/restapi'

// Organizational
param pcsOpsEmail = 'ops@pcsww.com'
param pcsLegalEmail = 'legal@pcsww.com'

// Secrets — resolved from ops Key Vault at deploy time
param dbAdminPassword = az.getSecret(
  'c1002d33-870c-4fcc-a831-0c0c057491da',
  'RG-PCS-ABTI-DEV',
  'abti-ops-kv-dev',
  'db-admin-password'
)
param jwtSecret = az.getSecret(
  'c1002d33-870c-4fcc-a831-0c0c057491da',
  'RG-PCS-ABTI-DEV',
  'abti-ops-kv-dev',
  'jwt-secret'
)
param adminSecret = az.getSecret(
  'c1002d33-870c-4fcc-a831-0c0c057491da',
  'RG-PCS-ABTI-DEV',
  'abti-ops-kv-dev',
  'admin-secret'
)
