/*
@codescope
@title Integer and floating-point arithmetic
@seed a min=10 max=25
@seed b min=2 max=9
@seed x min=10.0 max=25.0 decimals=1
@seed y min=2.0 max=9.0 decimals=1
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
