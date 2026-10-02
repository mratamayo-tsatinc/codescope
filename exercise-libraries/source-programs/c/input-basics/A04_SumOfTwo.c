/*
@codescope
@title Sum of Two Integers
@result total
@input target=x value=12 min=1 max=100
@input target=y value=30 min=1 max=100
*/
#include <stdio.h>

int main() {
    int x;
    int y;
    int total;

    printf("Enter the first integer: ");
    scanf("%d", &x);
    printf("Enter the second integer: ");
    scanf("%d", &y);
    total = x + y;
    printf("Total: %d\n", total);
    return 0;
}
