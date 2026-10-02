/*
@codescope
@title Average of Two Real Numbers
@result average
@input target=a value=7 min=0 max=100
@input target=b value=9 min=0 max=100
*/
#include <stdio.h>

int main() {
    int a;
    int b;
    float average;

    printf("Enter two real numbers: ");
    scanf("%d %d", &a, &b);
    average = (a + b) / 2.0;
    printf("Average: %.2f\n", average);
    return 0;
}
