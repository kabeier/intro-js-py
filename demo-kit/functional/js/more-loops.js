let user = { name: "Alex", age: 30 };

for (let key in user) {
  console.log(key);
}
for (let [key, value] of Object.entries(user)) {
  console.log(key, value);
}

let count = 0;
while (count < 3) {
  console.log(count);
  count++;
}
