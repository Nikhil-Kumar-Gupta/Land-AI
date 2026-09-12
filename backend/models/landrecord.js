const landRecords = [
  {
    id: "LR001",
    pincode: "500001",
    locality: "Hyderabad",
    status: "owner_ready",
    ownerCount: 12,
    pendingCases: 2,
    disputes: 1,
    overPrice: 3,
    govtClearance: 88
  },
  {
    id: "LR002",
    pincode: "500032",
    locality: "Gachibowli",
    status: "over_price",
    ownerCount: 20,
    pendingCases: 5,
    disputes: 2,
    overPrice: 10,
    govtClearance: 70
  },
  {
    id: "LR003",
    pincode: "500081",
    locality: "Madhapur",
    status: "pending_case",
    ownerCount: 15,
    pendingCases: 8,
    disputes: 4,
    overPrice: 5,
    govtClearance: 60
  },
  {
    id: "LR004",
    pincode: "500034",
    locality: "Banjara Hills",
    status: "dispute",
    ownerCount: 10,
    pendingCases: 6,
    disputes: 7,
    overPrice: 4,
    govtClearance: 52
  }
];

function findByPincode(pincode) {
  return landRecords.filter(record => record.pincode === pincode);
}

module.exports = {
  landRecords,
  findByPincode
};