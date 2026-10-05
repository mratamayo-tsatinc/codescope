/*
@codescope
@title Sum of Three Integers in One scanf
@result total
@input target=x value=4 min=1 max=20 step=1
@input target=y value=7 min=1 max=20 step=1
@input target=z value=2 min=1 max=20 step=1
*/
#include <stdio.h>

int main() {
    int x;
    int y;
    int z;
    int total;

    printf("Enter three integers: ");
    scanf("%d %d %d", &x, &y, &z);
    total = x + y + z;
    printf("Total: %d\n", total);
    return 0;
}
