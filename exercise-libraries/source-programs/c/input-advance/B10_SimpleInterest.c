/*
@codescope
@title Simple Interest
@result totalAmount
@input target=principal value=10000.0 min=1000.0 max=100000.0 step=1000.0 decimals=2
@input target=rate value=5.5 min=1.0 max=20.0 step=0.5 decimals=1
@input target=years value=3 min=1 max=30 step=1
*/
#include <stdio.h>

#define PERCENT 100

int main() {
    float principal;
    float rate;
    int years;
    float interest;
    float totalAmount;

    printf("Enter the principal amount: ");
    scanf("%f", &principal);
    printf("Enter the yearly rate (percent) and number of years: ");
    scanf("%f %d", &rate, &years);
    interest = principal * rate * years / PERCENT;
    totalAmount = principal + interest;
    printf("Interest: %.2f\n", interest);
    printf("Total amount: %.2f\n", totalAmount);
    return 0;
}
