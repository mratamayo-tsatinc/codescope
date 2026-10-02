/*
@codescope
@title Two Integers in One scanf
@result y
@input target=x value=8 min=1 max=100
@input target=y value=15 min=1 max=100
*/
#include <stdio.h>

int main() {
    int x;
    int y;

    printf("Enter two integers: ");
    scanf("%d %d", &x, &y);
    printf("x = %d, y = %d\n", x, y);
    return 0;
}
