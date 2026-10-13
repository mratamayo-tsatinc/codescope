/*
@codescope
@title Museum Ticket Pricing
@seed age min=12 max=28
@seed regularPrice min=120 max=180 step=20
@seed discount min=20 max=40 step=10
*/
#include <stdio.h>

int main(void)
{
    int age = 16;
    int regularPrice = 160;
    int discount = 30;
    int ticketPrice;

    if (age < 18) {
        ticketPrice = regularPrice - discount;
    } else {
        ticketPrice = regularPrice;
    }

    printf("MUSEUM ADMISSION\n");
    printf("Ticket charge: P%d\n", ticketPrice);

    return 0;
}

