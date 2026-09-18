// Generated from exercises/*.c. Run import-exercises.cjs after editing them.
const SO_EXERCISES=Object.freeze([
  {
    "id": "TaskAlpha",
    "filename": "TaskAlpha.c",
    "raw": "/*\n@output\nLearning C Programming!\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"Learning C Programming!\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskBravo",
    "filename": "TaskBravo.c",
    "raw": "/*\n@output\nLearn\nLearning C\nLearning C Pro\nLearning C Program\nLearning C Programming!\n\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"Learn\\n\");\n    printf(\"Learning C\\n\");\n    printf(\"Learning C Pro\\n\");\n    printf(\"Learning C Program\\n\");\n    printf(\"Learning C Programming!\\n\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskCharlie",
    "filename": "TaskCharlie.c",
    "raw": "/*\n@output\n#####\n#####\n#####\n#####\n#####\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"#####\\n\");\n    printf(\"#####\\n\");\n    printf(\"#####\\n\");\n    printf(\"#####\\n\");\n    printf(\"#####\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskDelta",
    "filename": "TaskDelta.c",
    "raw": "/*\n@output\n@\n\n@@\n\n@@@\n\n@@@@\n\n@@@@@\n\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"@\\n\\n\");\n    printf(\"@@\\n\\n\");\n    printf(\"@@@\\n\\n\");\n    printf(\"@@@@\\n\\n\");\n    printf(\"@@@@@\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskEcho",
    "filename": "TaskEcho.c",
    "raw": "/*\n@output\nNUMBER SEQUENCE:\n5\n4\n3\n2\n1\n\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"NUMBER SEQUENCE:\\n\");\n    printf(\"5\\n\");\n    printf(\"4\\n\");\n    printf(\"3\\n\");\n    printf(\"2\\n\");\n    printf(\"1\\n\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskFoxtrot",
    "filename": "TaskFoxtrot.c",
    "raw": "/*\n@output\nNUMBER SEQUENCE:\n5 4 3 2 1\n\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n \nint main() {\n    printf(\"NUMBER SEQUENCE:\\n\");\n    printf(\"5 \");\n    printf(\"4 \");\n    printf(\"3 \");\n    printf(\"2 \");\n    printf(\"1\\n\");\n\n    return 0;\n}"
  },
  {
    "id": "TaskGolf",
    "filename": "TaskGolf.c",
    "raw": "/*\n@output\n===NO OUTPUT===\n@variables\na = 10\nb = 5\nc = 3\nd = 1\n*/\n#include <stdio.h>\n\nint main() {\n    int a = 10;\n    int b = 5;\n    int c = 3;\n    int d = 1;\n\n    printf(\"===NO OUTPUT===\");\n\n    return 0;\n}\n"
  },
  {
    "id": "TaskHotel",
    "filename": "TaskHotel.c",
    "raw": "/*\n@output\nLearning escape characters in C\nShe said, \"C programming is fun!\"\nIt's time to practice.\nFile path: C:\\Programs\\C\nLoading Done!      \n\n@variables\n(this program does not declare any variables)\n*/\n#include <stdio.h>\n\nint main() {\n    printf(\"Learning escape characters in C\\n\");\n    printf(\"She said, \\\"C programming is fun!\\\"\\n\");\n    printf(\"It\\'s time to practice.\\n\");\n    printf(\"File path: C:\\\\Programs\\\\C\\n\");\n    printf(\"Loading......\\r\");\n    printf(\"Loading Done!\\n\");\n    return 0;\n}"
  },
  {
    "id": "TaskIndia",
    "filename": "TaskIndia.c",
    "raw": "/*\n@output\nStored values:\n==========\na = 10\n==========\nb = 5\n==========\nc = 3\n==========\nd = 1\n==========\n\n@variables\na = 10\nb = 5\nc = 3\nd = 1\n*/\n#include <stdio.h>\n\nint main() {\n    int a = 10;\n    int b = 5;\n    int c = 3;\n    int d = 1;\n\n    printf(\"Stored values:\\n\");\n    printf(\"==========\\n\");\n    printf(\"a = %d\\n\", a);\n    printf(\"==========\\n\");\n    printf(\"b = %d\\n\", b);\n    printf(\"==========\\n\");\n    printf(\"c = %d\\n\", c);\n    printf(\"==========\\n\");\n    printf(\"d = %d\\n\", d);\n    printf(\"==========\\n\");\n\n    return 0;\n}\n"
  },
  {
    "id": "TaskJuliet",
    "filename": "TaskJuliet.c",
    "raw": "/*\n@output\nName: Maria\nAge: 20\nHeight: 165.5 cm\nGrade: A\nPi (2 decimals): 3.14\nPi (4 decimals): 3.1416\n\n@variables\nage = 20\nheight = 165.5\ngrade = A\nname = Maria\n*/\n#include <stdio.h>\n\nint main() {\n    int age = 20;\n    float height = 165.5;\n    char grade = 'A';\n    char name[] = \"Maria\";\n\n    printf(\"Name: %s\\n\", name);\n    printf(\"Age: %d\\n\", age);\n    printf(\"Height: %.1f cm\\n\", height);\n    printf(\"Grade: %c\\n\", grade);\n    printf(\"Pi (2 decimals): %.2f\\n\", 3.14159);\n    printf(\"Pi (4 decimals): %0.4f\\n\", 3.14159);\n    return 0;\n}"
  },
  {
    "id": "TaskKilo",
    "filename": "TaskKilo.c",
    "raw": "/*\n@output\nInitial score: 75\nInitial price: 9.50\nInitial letter: B\nUpdated score: 90\nUpdated price: 12.00\nUpdated letter: A\nFinal score: 95\n\n@variables\nscore = 95\nprice = 12.00\nletter = A\nbonus = 90\n*/\n#include <stdio.h>\n\nint main() {\n    int score;\n    float price;\n    char letter;\n\n    score = 75;\n    price = 9.5;\n    letter = 'B';\n\n    printf(\"Initial score: %d\\n\", score);\n    printf(\"Initial price: %.2f\\n\", price);\n    printf(\"Initial letter: %c\\n\", letter);\n\n    score = 90;\n    price = price + 2.5;\n    letter = 'A';\n\n    printf(\"Updated score: %d\\n\", score);\n    printf(\"Updated price: %.2f\\n\", price);\n    printf(\"Updated letter: %c\\n\", letter);\n\n    int bonus = score;\n    score = bonus + 5;\n\n    printf(\"Final score: %d\\n\", score);\n    return 0;\n}"
  },
  {
    "id": "TaskLima",
    "filename": "TaskLima.c",
    "raw": "/*\n@output\na = 15, b = 4\nSum: 19\nDifference: 11\nProduct: 60\nInteger Quotient: 3\nRemainder: 3\nFloat Quotient: 3.75\n\n@variables\nsum = 19\ndiff = 11\nproduct = 60\nquotient = 3\nremainder = 3\nfloatQuotient = 3.75\n*/\n#include <stdio.h>\n\nint main() {\n    int a = 15;\n    int b = 4;\n\n    int sum = a + b;\n    int diff = a - b;\n    int product = a * b;\n    int quotient = a / b;\n    int remainder = a % b;\n\n    float x = 15.0;\n    float y = 4.0;\n    float floatQuotient = x / y;\n\n    printf(\"a = %d, b = %d\\n\", a, b);\n    printf(\"Sum: %d\\n\", sum);\n    printf(\"Difference: %d\\n\", diff);\n    printf(\"Product: %d\\n\", product);\n    printf(\"Integer Quotient: %d\\n\", quotient);\n    printf(\"Remainder: %d\\n\", remainder);\n    printf(\"Float Quotient: %.2f\\n\", floatQuotient);\n\n    return 0;\n}"
  },
  {
    "id": "TaskMike",
    "filename": "TaskMike.c",
    "raw": "/*\n@output\nx = 10, y = 7\nx == y : 0\nx != y : 1\nx > y  : 1\nx <= y : 0\nx == 10 : 1\n\n@variables\nisEqual = 0\nisNotEqual = 1\nisGreater = 1\nisLessOrEqual = 0\nisEqualToItself = 1\n*/\n#include <stdio.h>\n\nint main() {\n    int x = 10;\n    int y = 7;\n\n    int isEqual = (x == y);\n    int isNotEqual = (x != y);\n    int isGreater = (x > y);\n    int isLessOrEqual = (x <= y);\n    int isEqualToItself = (x == 10);\n\n    printf(\"x = %d, y = %d\\n\", x, y);\n    printf(\"x == y : %d\\n\", isEqual);\n    printf(\"x != y : %d\\n\", isNotEqual);\n    printf(\"x > y  : %d\\n\", isGreater);\n    printf(\"x <= y : %d\\n\", isLessOrEqual);\n    printf(\"x == 10 : %d\\n\", isEqualToItself);\n\n    return 0;\n}"
  },
  {
    "id": "TaskNovember",
    "filename": "TaskNovember.c",
    "raw": "/*\n@output\nage = 19\nhasID = 1\nhasTicket = 0\ncanEnterClub: 1\ncanWatchMovie: 1\nisDenied: 0\ncomplexCheck: 1\n\n@variables\ncanEnterClub = 1\ncanWatchMovie = 1\nisDenied = 0\ncomplexCheck = 1\n*/\n#include <stdio.h>\n\nint main() {\n    int age = 19;\n    int hasID = 1;\n    int hasTicket = 0;\n\n    int canEnterClub = (age >= 18) && hasID;\n    int canWatchMovie = (age >= 13) || hasTicket;\n    int isDenied = !canEnterClub;\n    int complexCheck = (age > 17 && hasID == 1) || (hasTicket == 1 && age > 21);\n\n    printf(\"age = %d\\n\", age);\n    printf(\"hasID = %d\\n\", hasID);\n    printf(\"hasTicket = %d\\n\", hasTicket);\n    printf(\"canEnterClub: %d\\n\", canEnterClub);\n    printf(\"canWatchMovie: %d\\n\", canWatchMovie);\n    printf(\"isDenied: %d\\n\", isDenied);\n    printf(\"complexCheck: %d\\n\", complexCheck);\n\n    return 0;\n}"
  },
  {
    "id": "TaskOscar",
    "filename": "TaskOscar.c",
    "raw": "/*\n@output\nWelcome to Tech Haven!\n\n@variables\nisLoyalMember = 1\nqualifiesForDiscount = 1\nsubtotal = 2400.00\ndiscount = 240.00\ntaxedAmount = 172.8000\nfinalTotal = 2332.80\nMEMBER_DISCOUNT_YEARS = 2\n*/\n#include <stdio.h>\n#define TAX_RATE 0.08\n#define SHOP_NAME \"Tech Haven\"\n\nint main() {\n    const int MEMBER_DISCOUNT_YEARS = 2;\n\n    char customerName[] = \"Diego\";\n    int yearsAsMember = 3;\n    float itemPrice = 1200.0;\n    int quantity = 2;\n\n    printf(\"Welcome to %s!\\n\", SHOP_NAME);\n\n    int isLoyalMember = (yearsAsMember >= MEMBER_DISCOUNT_YEARS);\n    float subtotal = itemPrice * quantity;\n    int qualifiesForDiscount = isLoyalMember && (subtotal > 1000);\n    float discount = subtotal * 0.10 * qualifiesForDiscount;\n    float taxedAmount = (subtotal - discount) * TAX_RATE;\n    float finalTotal = subtotal - discount + taxedAmount;\n\n    return 0;\n}"
  },
  {
    "id": "TaskPapa",
    "filename": "TaskPapa.c",
    "raw": "/*\n@output\nInitial value of a: 5\nInitial value of b: 5\nInitial value of c: 10\nInitial value of d: 10\n\nUpdated value of a: 4\nUpdated value of b: 6\nUpdated value of c: 11\nUpdated value of d: 9\n\nsum = ++p + q++ : 9\nfinal p: 5\nfinal q: 5\n\n@variables\na = 4\nb = 6\nc = 11\nd = 9\np = 5\nq = 5\nsum = 9\n*/\n#include <stdio.h>\n\nint main() {\n    int a = 5;\n    int b = 5;\n    int c = 10;\n    int d = 10;\n\n    printf(\"Initial value of a: %d\\n\", a);\n    printf(\"Initial value of b: %d\\n\", b);\n    printf(\"Initial value of c: %d\\n\", c);\n    printf(\"Initial value of d: %d\\n\", d);\n    printf(\"\\n\");\n\n    a--;\n    ++b;\n    c++;\n    --d;\n\n    printf(\"Updated value of a: %d\\n\", a);\n    printf(\"Updated value of b: %d\\n\", b);\n    printf(\"Updated value of c: %d\\n\", c);\n    printf(\"Updated value of d: %d\\n\", d);\n    printf(\"\\n\");\n\n    int p = 4;\n    int q = 4;\n    int sum = ++p + q++;\n\n    printf(\"sum = ++p + q++ : %d\\n\", sum);\n    printf(\"final p: %d\\n\", p);\n    printf(\"final q: %d\\n\", q);\n\n    return 0;\n}"
  },
  {
    "id": "TaskQuebec",
    "filename": "TaskQuebec.c",
    "raw": "/*\n@output\ninitial total: 20\n35->27->81->20->0\n\ninitial balance: 100.00\nfinal balance: 65.12\n\n@variables\ntotal = 0\nbalance = 65.12\n*/\n#include <stdio.h>\n\nint main() {\n    int total = 20;\n    printf(\"initial total: %d\\n\", total);\n\n    total += 15;\n    printf(\"%d->\", total);\n\n    total -= 8;\n    printf(\"%d->\", total);\n\n    total *= 3;\n    printf(\"%d->\", total);\n\n    total /= 4;\n    printf(\"%d->\", total);\n\n    total %= 5;\n    printf(\"%d\\n\\n\", total);\n\n    float balance = 100.0;\n    printf(\"initial balance: %.2f\\n\", balance);\n\n    balance += 50.5;\n    balance -= 20.25;\n    balance *= 2;\n    balance /= 4;\n\n    printf(\"final balance: %.2f\\n\", balance);\n\n    return 0;\n}"
  },
  {
    "id": "TaskRomeo",
    "filename": "TaskRomeo.c",
    "raw": "/*\n@output\nage = 19, hasID = 1, hasTicket = 0\ncanEnterClub: 1\ncanWatchMovie: 1\nisDenied: 0\ncomplexCheck: 1\n\n@variables\ncanEnterClub = 1\ncanWatchMovie = 1\nisDenied = 0\ncomplexCheck = 1\n*/\n#include <stdio.h>\n\nint main() {\n    int age = 19;\n    int hasID = 1;\n    int hasTicket = 0;\n\n    int canEnterClub = (age >= 18) && hasID;\n    int canWatchMovie = (age >= 13) || hasTicket;\n    int isDenied = !canEnterClub;\n    int complexCheck = (age > 17 && hasID == 1) || (hasTicket == 1 && age > 21);\n\n    printf(\"age = %d, hasID = %d, hasTicket = %d\\n\", age, hasID, hasTicket);\n    printf(\"canEnterClub: %d\\n\", canEnterClub);\n    printf(\"canWatchMovie: %d\\n\", canWatchMovie);\n    printf(\"isDenied: %d\\n\", isDenied);\n    printf(\"complexCheck: %d\\n\", complexCheck);\n\n    return 0;\n}"
  },
  {
    "id": "TaskSierra",
    "filename": "TaskSierra.c",
    "raw": "/*\n@output\nWelcome to Tech Haven!\nCustomer: \"Diego\"\nQuantity: 2\nSubtotal: 2400.00\nIs loyal member: 1\nDiscount: 240.00\nTax: 172.8000\nFinal Total: 2332.80\nHave a great day, Diego!\n\n@variables\nisLoyalMember = 1\nqualifiesForDiscount = 1\nsubtotal = 2400.00\ndiscount = 240.00\ntaxedAmount = 172.8000\nfinalTotal = 2332.80\nMEMBER_DISCOUNT_YEARS = 2\n*/\n#include <stdio.h>\n#define TAX_RATE 0.08\n#define SHOP_NAME \"Tech Haven\"\n\nint main() {\n    const int MEMBER_DISCOUNT_YEARS = 2;\n\n    char customerName[] = \"Diego\";\n    int yearsAsMember = 3;\n    float itemPrice = 1200.0;\n    int quantity = 2;\n\n    printf(\"Welcome to %s!\\n\", SHOP_NAME);\n    printf(\"Customer: \\\"%s\\\"\\n\", customerName);\n\n    int isLoyalMember = (yearsAsMember >= MEMBER_DISCOUNT_YEARS);\n    float subtotal = itemPrice * quantity;\n    int qualifiesForDiscount = isLoyalMember && (subtotal > 1000);\n    float discount = subtotal * 0.10 * qualifiesForDiscount;\n    float taxedAmount = (subtotal - discount) * TAX_RATE;\n    float finalTotal = subtotal - discount + taxedAmount;\n\n    printf(\"Quantity: %d\\n\", quantity);\n    printf(\"Subtotal: %.2f\\n\", subtotal);\n    printf(\"Is loyal member: %d\\n\", isLoyalMember);\n    printf(\"Discount: %.2f\\n\", discount);\n    printf(\"Tax: %0.4f\\n\", taxedAmount);\n    printf(\"Final Total: %.2f\\n\", finalTotal);\n    printf(\"Have a great day, %s!\\n\", customerName);\n\n    return 0;\n}"
  }
]);
