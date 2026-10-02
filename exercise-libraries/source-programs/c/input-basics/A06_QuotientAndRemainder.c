/*
@codescope
@title Integer Division and Remainder
@result quotient
@input target=dividend value=47 min=1 max=100
@input target=divisor value=5 min=1 max=100
*/
#include <stdio.h>

int main() {
    int dividend;
    int divisor;
    int quotient;
    int remainder;

    printf("Enter the dividend: ");
    scanf("%d", &dividend);
    printf("Enter the divisor: ");
    scanf("%d", &divisor);
    quotient = dividend / divisor;
    remainder = dividend % divisor;
    printf("Quotient: %d\n", quotient);
    printf("Remainder: %d\n", remainder);
    return 0;
}
