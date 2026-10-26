multiply = lambda a, b: a * b
print(multiply(3, 4))

nums = [3, 1, 4, 2]
evens = list(filter(lambda n: n % 2 == 0, nums))
doubled = [n * 2 for n in nums]
print(evens, doubled, nums)

sorted_nums = sorted(nums)
print(sorted_nums, nums)
