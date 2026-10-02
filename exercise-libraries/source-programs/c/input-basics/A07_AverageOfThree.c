/*
@codescope
@title Average of Three Integers
@result average
@input target=x value=85 min=0 max=100
@input target=y value=90 min=0 max=100
@input target=z value=78 min=0 max=100
*/
#include <stdio.h>

int main() {
    int x;
    int y;
    int z;
    float average;

    printf("Enter the first score: ");
    scanf("%d", &x);
    printf("Enter the second score: ");
    scanf("%d", &y);
    printf("Enter the third score: ");
    scanf("%d", &z);
    average = (x + y + z) / 3.0;
    printf("Average: %.2f\n", average);
    return 0;
}
