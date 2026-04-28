using '../main.bicep'

// Resource names
param keyVaultName = 'abti-kv-prod2'
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
param vnetName = 'VNET-ABTI-PROD'

// Integrations
param docusignBasePath = 'https://www.docusign.net/restapi'

// Organizational
param pcsOpsEmail = 'ops@pcsww.com'
param pcsLegalEmail = 'legal@pcsww.com'

// Secrets — resolved from ops Key Vault at deploy time
param dbAdminPassword = az.getSecret(
  'df7b3148-9fee-4d20-82b4-25bc3da3149c',
  'RG-PCS-ABTI-PROD',
  'abti-ops-kv-prod',
  'db-admin-password'
)
param jwtSecret = az.getSecret(
  'df7b3148-9fee-4d20-82b4-25bc3da3149c',
  'RG-PCS-ABTI-PROD',
  'abti-ops-kv-prod',
  'jwt-secret'
)
param adminSecret = az.getSecret(
  'df7b3148-9fee-4d20-82b4-25bc3da3149c',
  'RG-PCS-ABTI-PROD',
  'abti-ops-kv-prod',
  'admin-secret'
)
