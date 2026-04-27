// network.bicep — VNet, subnets, and private DNS zone for PostgreSQL VNet injection.
// Only deployed when enablePrivateNetworking = true (production).
// Both the VNet and the PostgreSQL server must be in the same region (location param).

param location string
param vnetName string
param dbServerName string

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
  }
}

// Subnet for App Service Regional VNet Integration (outbound from API + worker).
resource appServiceSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  parent: vnet
  name: 'subnet-appservice'
  properties: {
    addressPrefix: '10.0.1.0/24'
  }
}

// Subnet for PostgreSQL Flexible Server VNet injection.
// Must be delegated to Microsoft.DBforPostgreSQL/flexibleServers.
// Subnets in the same VNet must be created sequentially.
resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  parent: vnet
  name: 'subnet-postgres'
  dependsOn: [appServiceSubnet]
  properties: {
    addressPrefix: '10.0.2.0/24'
    delegations: [
      {
        name: 'postgres-delegation'
        properties: {
          serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
        }
      }
    ]
  }
}

// Private DNS zone so App Services resolve the PostgreSQL hostname to its
// private IP rather than a public address.
var privateDnsZoneName = '${dbServerName}.private.postgres.database.azure.com'

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsZoneName
  location: 'global'
}

resource dnsVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: 'link-${vnetName}'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

output vnetId string = vnet.id
output appServiceSubnetId string = appServiceSubnet.id
output postgresSubnetId string = postgresSubnet.id
output privateDnsZoneId string = privateDnsZone.id
