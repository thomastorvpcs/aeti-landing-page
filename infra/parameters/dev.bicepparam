using '../main.bicep'

// Resource names
param keyVaultName = 'abti-kv-dev'
param storageAccountName = 'abtiresellerdatadev'
param serviceBusNamespaceName = 'abti-onboarding-pcs-dev'
param dbServerName = 'abti-db-dev'
param appServicePlanName = 'asp-abti-plan-dev'
param apiAppName = 'abti-api-dev'
param workerAppName = 'abti-worker-dev'
param staticWebAppName = 'abti-frontend-dev'

// Compute
param appServicePlanSku = 'B2'
param staticWebAppSku = 'Free'

// Database
param dbSkuName = 'Standard_B1ms'
param dbSkuTier = 'Burstable'
param geoRedundantBackup = false

// Private networking off for dev — B2 plan does not support VNet Integration
param enablePrivateNetworking = false

// Integrations
param docusignBasePath = 'https://demo.docusign.net/restapi'

// Organizational
param pcsOpsEmail = 'ops@pcsww.com'
param pcsLegalEmail = 'legal@pcsww.com'

// Secrets — passed at deploy time, stored in Key Vault by this deployment.
// Do not hardcode values here. Pass on the CLI:
//   --parameters dbAdminPassword="..." jwtSecret="..." adminSecret="..."
