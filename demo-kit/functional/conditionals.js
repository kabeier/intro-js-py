let score = 85;

if (score >= 90) {
  console.log("Pass with Honors");
} else if (score >= 70) {
  console.log("Pass");
} else {
  console.log("Fail");
}

// AND: both must be true
let age = 21;
let hasId = true;

if (age >= 21 && hasId) {
  console.log("This adult can drink");
} else if (age >= 18) {
  console.log("This is an adult but can't drink");
} else {
  console.log("This person is a minor");
}
