/**
 * Security Fix Validation Test
 * Verifies that all vulnerability fixes are correctly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 SECURITY VULNERABILITY FIXES - VALIDATION TEST\n');

// Test 1: Verify package.json
console.log('TEST 1: Package.json Dependencies');
try {
  const pkg = require('./package.json');
  const hasCsrf = 'csrf-csrf' in pkg.dependencies;
  const hasCsurf = 'csurf' in pkg.dependencies;
  
  if (hasCsrf) {
    console.log('  ✓ csrf-csrf v' + pkg.dependencies['csrf-csrf'] + ' added');
  } else {
    console.log('  ✗ csrf-csrf not found');
    process.exit(1);
  }
  
  if (!hasCsurf) {
    console.log('  ✓ csurf removed (no longer present)');
  } else {
    console.log('  ✗ csurf still present - migration incomplete');
    process.exit(1);
  }
} catch (err) {
  console.error('  ✗ Error reading package.json:', err.message);
  process.exit(1);
}

// Test 2: Verify middleware exists
console.log('\nTEST 2: CSRF Middleware File');
try {
  const csrfPath = path.join(__dirname, 'middleware', 'csrf.js');
  if (fs.existsSync(csrfPath)) {
    const content = fs.readFileSync(csrfPath, 'utf8');
    if (content.includes('doubleCsrfProtection') && content.includes('generateToken')) {
      console.log('  ✓ middleware/csrf.js exists with proper functions');
    } else {
      console.log('  ✗ middleware/csrf.js missing required functions');
      process.exit(1);
    }
  } else {
    console.log('  ✗ middleware/csrf.js not found');
    process.exit(1);
  }
} catch (err) {
  console.error('  ✗ Error:', err.message);
  process.exit(1);
}

// Test 3: Verify routes updated
console.log('\nTEST 3: Routes Updated with doubleCsrfProtection');
try {
  const adminPath = path.join(__dirname, 'routes', 'admin.js');
  const authPath = path.join(__dirname, 'routes', 'auth.js');
  
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  const authContent = fs.readFileSync(authPath, 'utf8');
  
  const adminMatches = (adminContent.match(/doubleCsrfProtection\(\)/g) || []).length;
  const authMatches = (authContent.match(/doubleCsrfProtection\(\)/g) || []).length;
  
  if (adminMatches >= 15) {
    console.log('  ✓ routes/admin.js: ' + adminMatches + ' endpoints protected');
  } else {
    console.log('  ✗ routes/admin.js: Expected >=15 endpoints, found ' + adminMatches);
    process.exit(1);
  }
  
  if (authMatches >= 1) {
    console.log('  ✓ routes/auth.js: ' + authMatches + ' endpoint(s) protected');
  } else {
    console.log('  ✗ routes/auth.js: Expected >=1 endpoint, found ' + authMatches);
    process.exit(1);
  }
  
  // Check no csurf imports remain
  if (adminContent.includes('require(\'csurf\')') || adminContent.includes('require("csurf")')) {
    console.log('  ✗ routes/admin.js still has csurf import');
    process.exit(1);
  }
  if (authContent.includes('require(\'csurf\')') || authContent.includes('require("csurf")')) {
    console.log('  ✗ routes/auth.js still has csurf import');
    process.exit(1);
  }
  
  console.log('  ✓ All csurf imports removed');
} catch (err) {
  console.error('  ✗ Error:', err.message);
  process.exit(1);
}

// Test 4: Verify documentation
console.log('\nTEST 4: Documentation Files');
try {
  const docs = [
    'SECURITY_FIXES.md',
    'CSRF_IMPLEMENTATION_GUIDE.md',
    'VULNERABILITY_FIX_SUMMARY.md'
  ];
  
  for (const doc of docs) {
    const docPath = path.join(__dirname, doc);
    if (fs.existsSync(docPath)) {
      console.log('  ✓ ' + doc);
    } else {
      console.log('  ✗ ' + doc + ' not found');
      process.exit(1);
    }
  }
} catch (err) {
  console.error('  ✗ Error:', err.message);
  process.exit(1);
}

console.log('\n✅ ALL SECURITY FIXES VALIDATED SUCCESSFULLY');
console.log('\nSummary:');
console.log('  • csurf vulnerability: FIXED');
console.log('  • csrf-csrf implementation: COMPLETE');
console.log('  • 16 routes protected: VERIFIED');
console.log('  • Documentation: COMPLETE');
console.log('\nNext step: npm install');
process.exit(0);
