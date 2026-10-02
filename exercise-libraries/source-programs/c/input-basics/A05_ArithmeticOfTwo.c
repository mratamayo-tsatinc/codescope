/*
@codescope
@title Sum, Difference and Product
@result product
@input target=a value=9 min=1 max=50
@input target=b value=4 min=1 max=50
*/
#include <stdio.h>

int main() {
    int a;
    int b;
    int sum;
    int difference;
    int product;

    printf("Enter the first integer: ");
    scanf("%d", &a);
    printf("Enter the second integer: ");
    scanf("%d", &b);
    sum = a + b;
    difference = a - b;
    product = a * b;
    printf("Sum: %d\n", sum);
    printf("Difference: %d\n", difference);
    printf("Product: %d\n", product);
    return 0;
}
