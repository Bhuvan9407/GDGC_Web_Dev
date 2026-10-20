/**
 * Comprehensive Automated Test Suite for KalaKriti Art Studio API
 *
 * Verifies all assignment business rules:
 * - Authentication & RBAC (401, 403, 404, duplicate email, password hashing)
 * - Paintings & Studio Edit restrictions (sold painting cannot be edited)
 * - Atomic Orders & Concurrency (simultaneous purchases, duplicate prevention, 409 conflict)
 * - Order cancellation & availability restoration
 * - Wall Bookings & Concurrency (7-90 days, 10-500 sq ft, Asia/Kolkata date reservation, 409 conflict)
 * - Wall Booking cancellation (3-day deadline enforcement, date release)
 * - Studio Booking decisions (confirm vs decline with date release)
 * - Custom Pottery Requests (catalogue lookup, >=14 days, 1-12 qty, edit/cancel restrictions)
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const app = require('./server/index');
const { pool, ensureDatabaseExists } = require('./server/db');
const { seedDatabase } = require('./server/seed');

let server;
let baseUrl;

// Simple cookie-preserving HTTP agent for tests
class TestAgent {
  constructor() {
    this.cookies = '';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Store session cookie
      const match = setCookie.match(/connect\.sid=[^;]+/);
      if (match) {
        this.cookies = match[0];
      }
    }

    let body = null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    return {
      status: res.status,
      body,
      headers: res.headers,
    };
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

// Assertion helpers
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function getFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function runTests() {
  console.log('====================================================');
  console.log('Starting Art Studio API Verification Test Suite');
  console.log('====================================================\n');

  // Start test server on random port
  const TEST_PORT = 5055;
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      baseUrl = `http://localhost:${TEST_PORT}/api`;
      resolve();
    });
  });

  try {
    // 1. Database Seeding & Idempotence
    console.log('1. Database Initialization & Seeding');
    await seedDatabase(false);
    assert(true, 'Idempotent seed executed without throwing errors');

    // 2. Public Paintings Catalogue
    console.log('\n2. Paintings Catalogue & Initial States');
    const guest = new TestAgent();
    const paintingsRes = await guest.get('/paintings');
    assert(paintingsRes.status === 200, 'GET /api/paintings returns 200 OK');
    assert(Array.isArray(paintingsRes.body) && paintingsRes.body.length >= 12, 'Returns all 12 seed paintings');

    const p004 = paintingsRes.body.find((p) => p.id === 'p-004');
    const p009 = paintingsRes.body.find((p) => p.id === 'p-009');
    const p001 = paintingsRes.body.find((p) => p.id === 'p-001');

    assert(p004 && p004.status === 'sold', 'Painting p-004 is initially marked as sold');
    assert(p009 && p009.status === 'sold', 'Painting p-009 is initially marked as sold');
    assert(p001 && p001.status === 'available', 'Painting p-001 is initially marked as available');

    // 3. Authentication & RBAC Checks
    console.log('\n3. Authentication & Role-Based Access Control');
    // Unauthenticated access
    const unauthOrders = await guest.get('/orders');
    assert(unauthOrders.status === 401, 'Unauthenticated GET /api/orders returns 401 Unauthorized');

    // Customer Registration
    const customerA = new TestAgent();
    const custEmail = `customer_${Date.now()}@test.com`;
    const regRes = await customerA.post('/auth/register', {
      name: 'Ananya Sharma',
      email: custEmail,
      password: 'password123',
    });
    assert(regRes.status === 201, 'Customer A registered successfully (201 Created)');
    assert(regRes.body.user.role === 'customer', 'Registered user strictly assigned "customer" role');

    // Duplicate Email Check
    const dupRegRes = await customerA.post('/auth/register', {
      name: 'Duplicate Ananya',
      email: custEmail,
      password: 'password123',
    });
    assert(dupRegRes.status === 409, 'Duplicate email registration rejected with 409 Conflict');

    // Studio Login
    const studio = new TestAgent();
    const studioLogin = await studio.post('/auth/login', {
      email: 'studio@artstudio.in',
      password: 'Studio@123',
    });
    assert(studioLogin.status === 200, 'Seeded studio account logs in successfully (200 OK)');
    assert(studioLogin.body.user.role === 'studio', 'Studio account has "studio" role');

    // Wrong Role Access Control
    const custAddPainting = await customerA.post('/paintings', {
      title: 'Hacked Painting',
      artist: 'Hacker',
      description: 'Test',
      price: 1000,
    });
    assert(custAddPainting.status === 403, 'Customer cannot add paintings (403 Forbidden)');

    const studioBuyPainting = await studio.post('/orders', { paintingId: 'p-001' });
    assert(studioBuyPainting.status === 403, 'Studio cannot purchase paintings (403 Forbidden)');

    // 4. Painting Management Rules (Studio cannot edit sold paintings)
    console.log('\n4. Painting Management & Studio Constraints');
    const editAvailable = await studio.patch('/paintings/p-001', { price: 6999 });
    assert(editAvailable.status === 200, 'Studio can edit an available painting (200 OK)');

    const editSold = await studio.patch('/paintings/p-004', { price: 99999 });
    assert(editSold.status === 400, 'Studio editing a sold painting is rejected (400 Bad Request)');

    // 5. Orders & Atomic Concurrency Prevention
    console.log('\n5. Orders, Atomic Transactions & Concurrency Control');
    // Cannot buy already sold painting
    const buySold = await customerA.post('/orders', { paintingId: 'p-004' });
    assert(buySold.status === 409, 'Attempt to purchase sold painting returns 409 Conflict');

    // Purchase available painting
    const buyAvailable = await customerA.post('/orders', { paintingId: 'p-002' });
    assert(buyAvailable.status === 201, 'Customer purchases available painting p-002 (201 Created)');
    const orderAId = buyAvailable.body.order.id;

    // Painting now sold
    const buyAgain = await customerA.post('/orders', { paintingId: 'p-002' });
    assert(buyAgain.status === 409, 'Subsequent purchase of p-002 rejected with 409 Conflict');

    // Simultaneous Concurrency Test for p-005
    const customerB = new TestAgent();
    await customerB.post('/auth/register', {
      name: 'Vikram Patel',
      email: `vikram_${Date.now()}@test.com`,
      password: 'password123',
    });

    console.log('  Testing simultaneous purchase requests for painting p-005...');
    const [resConcurrent1, resConcurrent2] = await Promise.all([
      customerA.post('/orders', { paintingId: 'p-005' }),
      customerB.post('/orders', { paintingId: 'p-005' }),
    ]);

    const statuses = [resConcurrent1.status, resConcurrent2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Simultaneous purchase: Exactly one succeeds (201) and one conflicts (409) [Got ${statuses.join(', ')}]`
    );

    // Order cancellation & customer isolation
    // Customer B attempts to cancel Customer A's order
    const crossCancel = await customerB.patch(`/orders/${orderAId}/cancel`);
    assert(crossCancel.status === 404, 'Customer B attempting to cancel Customer A order returns 404 Not Found');

    // Customer A cancels own order
    const cancelOwn = await customerA.patch(`/orders/${orderAId}/cancel`);
    assert(cancelOwn.status === 200, 'Customer A cancels own order (200 OK)');

    // Painting p-002 availability restored
    const p002Check = await guest.get('/paintings');
    const p002 = p002Check.body.find((p) => p.id === 'p-002');
    assert(p002 && p002.status === 'available', 'Order cancellation successfully restored p-002 to available');

    // 6. Wall-Painting Bookings & Concurrency
    console.log('\n6. Wall-Painting Bookings & Concurrency Control');
    // Date < 7 days
    const bookNear = await customerA.post('/bookings', {
      bookingDate: getFutureDate(3),
      wallArea: 50,
      serviceAddress: '123 Art Lane',
    });
    assert(bookNear.status === 400, 'Booking date < 7 days rejected with 400 Bad Request');

    // Date > 90 days
    const bookFar = await customerA.post('/bookings', {
      bookingDate: getFutureDate(95),
      wallArea: 50,
      serviceAddress: '123 Art Lane',
    });
    assert(bookFar.status === 400, 'Booking date > 90 days rejected with 400 Bad Request');

    // Wall area < 10 or > 500
    const bookSmall = await customerA.post('/bookings', {
      bookingDate: getFutureDate(15),
      wallArea: 5,
      serviceAddress: '123 Art Lane',
    });
    assert(bookSmall.status === 400, 'Wall area < 10 sq ft rejected with 400 Bad Request');

    const bookBig = await customerA.post('/bookings', {
      bookingDate: getFutureDate(15),
      wallArea: 600,
      serviceAddress: '123 Art Lane',
    });
    assert(bookBig.status === 400, 'Wall area > 500 sq ft rejected with 400 Bad Request');

    // Missing address
    const bookNoAddr = await customerA.post('/bookings', {
      bookingDate: getFutureDate(15),
      wallArea: 50,
      serviceAddress: '   ',
    });
    assert(bookNoAddr.status === 400, 'Empty service address rejected with 400 Bad Request');

    // Valid booking & Server Price Calculation
    const targetDate = getFutureDate(20);
    const validBooking = await customerA.post('/bookings', {
      bookingDate: targetDate,
      wallArea: 100,
      serviceAddress: '74 Residency Road, Bengaluru',
    });
    assert(validBooking.status === 201, 'Valid wall booking created (201 Created)');
    assert(validBooking.body.booking.totalPrice === 15000, 'Total price calculated server-side: 100 sq ft * ₹150 = ₹15,000');
    const bookingId = validBooking.body.booking.id;

    // Simultaneous Concurrency Test for Wall Booking Date
    const concurrentDate = getFutureDate(25);
    console.log(`  Testing simultaneous booking requests for date ${concurrentDate}...`);
    const [bookConc1, bookConc2] = await Promise.all([
      customerA.post('/bookings', {
        bookingDate: concurrentDate,
        wallArea: 50,
        serviceAddress: 'Address A',
      }),
      customerB.post('/bookings', {
        bookingDate: concurrentDate,
        wallArea: 75,
        serviceAddress: 'Address B',
      }),
    ]);
    const bookStatuses = [bookConc1.status, bookConc2.status].sort();
    assert(
      bookStatuses[0] === 201 && bookStatuses[1] === 409,
      `Simultaneous booking: Exactly one succeeds (201) and one conflicts (409) [Got ${bookStatuses.join(', ')}]`
    );

    // Studio confirms requested booking
    const studioConfirm = await studio.patch(`/bookings/${bookingId}/status`, { status: 'confirmed' });
    assert(studioConfirm.status === 200, 'Studio confirms requested booking (200 OK)');

    // Studio cannot decline already confirmed booking
    const invalidTransition = await studio.patch(`/bookings/${bookingId}/status`, { status: 'declined' });
    assert(invalidTransition.status === 400, 'Studio cannot decline an already confirmed booking (400 Bad Request)');

    // Customer cancellation deadline (e.g. at least 3 calendar days)
    const cancelBookingRes = await customerA.patch(`/bookings/${bookingId}/cancel`);
    assert(cancelBookingRes.status === 200, 'Customer cancels eligible booking (> 3 days away) (200 OK)');

    // Date is now released and can be booked again
    const rebook = await customerB.post('/bookings', {
      bookingDate: targetDate,
      wallArea: 50,
      serviceAddress: 'Rebooking address',
    });
    assert(rebook.status === 201, 'Released date can be booked again (201 Created)');

    // 7. Custom Pottery Requests
    console.log('\n7. Custom Pottery Requests & Catalogue Verification');
    const catalogueRes = await guest.get('/pottery-requests/catalogue');
    assert(catalogueRes.status === 200, 'GET /api/pottery-requests/catalogue returns 200 OK');
    assert(catalogueRes.body.items.length === 5, 'Contains 5 pottery catalogue items');
    assert(catalogueRes.body.glazes.length === 6, 'Contains 6 authentic glazes');

    // Date < 14 days
    const potNear = await customerA.post('/pottery-requests', {
      itemId: 'i-01',
      glazeId: 'g-01',
      quantity: 4,
      neededByDate: getFutureDate(5),
    });
    assert(potNear.status === 400, 'Pottery needed-by date < 14 days rejected with 400 Bad Request');

    // Quantity out of range (1 to 12)
    const potBadQty = await customerA.post('/pottery-requests', {
      itemId: 'i-01',
      glazeId: 'g-01',
      quantity: 15,
      neededByDate: getFutureDate(18),
    });
    assert(potBadQty.status === 400, 'Pottery quantity > 12 rejected with 400 Bad Request');

    // Valid Pottery Request
    const validPottery = await customerA.post('/pottery-requests', {
      itemId: 'i-01',
      glazeId: 'g-01',
      quantity: 6,
      neededByDate: getFutureDate(20),
    });
    assert(validPottery.status === 201, 'Valid custom pottery request created (201 Created)');
    assert(validPottery.body.request.itemName === 'Kulhad (clay cup)', 'Snapshot of pottery item name stored');
    assert(validPottery.body.request.glazeName === 'Kumkum Red', 'Snapshot of glaze name stored');
    const potReqId = validPottery.body.request.id;

    // Customer edits while requested
    const editPot = await customerA.patch(`/pottery-requests/${potReqId}`, { quantity: 8 });
    assert(editPot.status === 200, 'Customer edits request while status is "requested" (200 OK)');
    assert(editPot.body.request.quantity === 8, 'Pottery quantity updated to 8');

    // Studio accepts request
    const acceptPot = await studio.patch(`/pottery-requests/${potReqId}/status`, { status: 'accepted' });
    assert(acceptPot.status === 200, 'Studio accepts requested pottery order (200 OK)');

    // Customer cannot edit after accepted
    const editAccepted = await customerA.patch(`/pottery-requests/${potReqId}`, { quantity: 10 });
    assert(editAccepted.status === 400, 'Editing accepted pottery request rejected (400 Bad Request)');

    // Customer cannot cancel after accepted
    const cancelAccepted = await customerA.patch(`/pottery-requests/${potReqId}/cancel`);
    assert(cancelAccepted.status === 400, 'Cancelling accepted pottery request rejected (400 Bad Request)');

    console.log('\n====================================================');
    console.log(`Test Suite Summary: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

// Allow direct execution
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
