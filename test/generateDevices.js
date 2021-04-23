module.exports = (count) => {
  const devices = []
  let numberBase = 100000000
  for (let i = 0; i < count; i++) {
    devices.push({ UserEmailAddress: `user${i}.name@email.com`, PhoneNumber: `07${numberBase++}` })
  }
  return devices
}
