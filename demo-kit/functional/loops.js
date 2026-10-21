let colors = ["red", "green", "blue"];

// by value: for...of
for (let color of colors) {
  console.log(color);
}

// by index
for (let i = 0; i < colors.length; i++) {
  console.log(i, colors[i]);
}

// both
for (const [idx, color] of colors.entries()) {
  console.log(idx, color);
}
