/*
@codescope
@title Average of Two Real Numbers
@result average
@input target=a value=7.5 min=0 max=100 step=0.5 decimals=2
@input target=b value=9.25 min=0 max=100 step=0.25 decimals=2
*/
#include <stdio.h>

int main() {
    float a;
    float b;
    float average;

    printf("Enter two real numbers: ");
    scanf("%f %f", &a, &b);
    average = (a + b) / 2.0;
    printf("Average: %.2f\n", average);
    return 0;
}
