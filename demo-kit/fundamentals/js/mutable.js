// a list is mutable: it changes in place
let colors = ["red", "green"];
colors.push("blue");
console.log(colors);

// a string is immutable: you get a NEW string
let name = "alex";
let loud = name.toUpperCase();
console.log(name, loud);

// the bug: two labels, one list
let copy = colors;
copy.push("pink");
console.log(colors);
