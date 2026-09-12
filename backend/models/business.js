const businesses = [
  {
    businessId: "LAND001",
    gst: "36ABCDE1234F1Z5",
    email: "nikhilgupta9052@gmail.com",
    name: "LandBuild Infrastructure Pvt. Ltd.",
    phone: "XXXXXXXXXX"
  },
  {
    businessId: "CONST002",
    gst: "29ABCDE5678G1Z2",
    email: "admin@constructa.com",
    name: "Constructa Projects",
    phone: "XXXXXXXXXX"
  }
];

function findBusinessByEmail(email) {
  return businesses.find(
    business => business.email.toLowerCase() === email.toLowerCase()
  );
}

function findBusinessById(id) {
  return businesses.find(
    business =>
      business.businessId.toLowerCase() === id.toLowerCase() ||
      business.gst.toLowerCase() === id.toLowerCase()
  );
}

module.exports = {
  businesses,
  findBusinessByEmail,
  findBusinessById
};