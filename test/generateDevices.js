function generate (count, modelId) {
  const Name = modelId === 1 ? 'iPhone_Model' : 'iPad_Model'
  const devices = []
  let numberBase = 10000000
  for (let i = 0; i < count; i++) {
    devices.push({
      ModelId: { Id: { Value: modelId }, Name },
      PhoneNumber: `07${modelId}${numberBase++}`,
      UserEmailAddress: `user${i}-${Name}@email.com`
    })
  }
  return devices
}

module.exports = {
  generateIPads: (count) => generate(count, 2),
  generateIPhones: (count) => generate(count, 1)
}
