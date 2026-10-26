function sayHi() {
  console.log("Good Afternoon");
}

sayHi();
sayHi();

// name is a parameter; "Alice" is the argument
function greet(name) {
  return "Good Afternoon " + name;
}

greet("Alice");
let result = greet("Sam");
console.log(result);
