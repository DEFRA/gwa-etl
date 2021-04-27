module.exports = (u1, u2) => {
  const users1 = new Map(u1.map(x => [x.emailAddress, x]))
  const users2 = new Map(u2.map(x => [x.emailAddress, x]))

  users1.forEach((user, emailAddress) => {
    const user2 = users2.get(emailAddress)
    if (user2) {
      users1.set(emailAddress, { ...user, ...user2 })
      users2.delete(emailAddress)
    }
  })

  users2.forEach((user, emailAddress) => {
    if (!users1.has(emailAddress)) {
      users1.set(emailAddress, user)
    }
  })

  return [...users1.values()]
}
