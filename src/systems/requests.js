// No fs here — this file must stay loadable from a browser; see
// requestsLoader.js for the Node-only reader.
//
// Requests the player makes to someone (data/requests/), like asking the
// parents to pay for something (parentPayment.js).

export function indexRequests(requests) {
  return Object.fromEntries(requests.map((request) => [request.id, request]));
}
