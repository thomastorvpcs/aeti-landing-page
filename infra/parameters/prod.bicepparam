using '../main.bicep'

// Resource names
param keyVaultName = 'abti-kv-prod'
param storageAccountName = 'abtiresellerdataprod'
param serviceBusNamespaceName = 'abti-onboarding-pcs-prod'
param dbServerName = 'abti-db-prod'
param appServicePlanName = 'asp-abti-plan-prod'
param apiAppName = 'abti-api-prod'
param workerAppName = 'abti-worker-prod'
param staticWebAppName = 'abti-frontend-prod'

// Compute
param appServicePlanSku = 'P1v3'
param staticWebAppSku = 'Standard'

// Database
param dbSkuName = 'Standard_D2s_v3'
param dbSkuTier = 'GeneralPurpose'
param geoRedundantBackup = true
// Private networking — fully private DB with no public endpoint
param enablePrivateNetworking = true
param vnetName = 'abti-vnet-prod'

// Integrations
param docusignBasePath = 'https://www.docusign.net/restapi'

// Organizational
param pcsOpsEmail = 'ops@pcsww.com'
param pcsLegalEmail = 'legal@pcsww.com'

// Secrets — passed at deploy time, stored in Key Vault by this deployment.
// Do not hardcode values here. Pass on the CLI:
//   --parameters dbAdminPassword="..." jwtSecret="..." adminSecret="..."
