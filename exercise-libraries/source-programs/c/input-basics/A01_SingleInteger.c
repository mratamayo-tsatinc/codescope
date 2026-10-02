/*
@codescope
@title Single Integer Input
@result x
@input target=x value=5 min=1 max=100
*/
#include <stdio.h>

int main() {
    int x;

    printf("Enter an integer: ");
    scanf("%d", &x);
    printf("You entered: %d\n", x);
    return 0;
}
