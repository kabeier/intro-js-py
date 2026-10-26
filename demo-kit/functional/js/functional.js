const multiply = (a, b) => a * b;
console.log(multiply(3, 4));

let nums = [3, 1, 4, 2];
let evens = nums.filter(n => n % 2 === 0);
let doubled = nums.map(n => n * 2);
console.log(evens, doubled, nums);

nums.sort((a, b) => a - b);
console.log(nums);
