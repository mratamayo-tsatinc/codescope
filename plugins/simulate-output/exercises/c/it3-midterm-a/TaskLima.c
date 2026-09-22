/*
@output
a = 15, b = 4
Sum: 19
Difference: 11
Product: 60
Integer Quotient: 3
Remainder: 3
Float Quotient: 3.75

@variables
sum = 19
diff = 11
product = 60
quotient = 3
remainder = 3
floatQuotient = 3.75
*/
#include <stdio.h>

int main() {
    int a = 15;
    int b = 4;

    int sum = a + b;
    int diff = a - b;
    int product = a * b;
    int quotient = a / b;
    int remainder = a % b;

    float x = 15.0;
    float y = 4.0;
    float floatQuotient = x / y;

    printf("a = %d, b = %d\n", a, b);
    printf("Sum: %d\n", sum);
    printf("Difference: %d\n", diff);
    printf("Product: %d\n", product);
    printf("Integer Quotient: %d\n", quotient);
    printf("Remainder: %d\n", remainder);
    printf("Float Quotient: %.2f\n", floatQuotient);

    return 0;
}