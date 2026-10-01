/*
@codescope
@title Ticket Price
@seed choice min=1 max=4
@seed tickets min=2 max=6
@seed ticketPrice min=60 max=85 step=5
@seed fee min=10 max=30 step=10
*/
#include <stdio.h>

int main(void)
{
    int choice = 3, tickets = 4, ticketPrice = 75, fee = 20;
    int subtotal, total, valid;

    subtotal = tickets * ticketPrice + 10 * 2;
    valid = (tickets > 0 && ticketPrice >= 50) ||
            (choice == 1 && !((tickets > 10)));

    switch (choice)
    {
        case 1:
            fee = fee + 5;
            break;
        case 2:
            fee = fee + 10;
            break;
        case 3:
            fee = fee + 0;
            break;
        default:
            fee = fee + 20;
    }

    if (valid && subtotal >= 300) {
        total = subtotal + fee;
    } else if (!valid || subtotal < 100) {
        total = subtotal + fee + 15;
    } else {
        total = subtotal + fee;
    } 
    
    printf("choice = %d\n", choice);
    printf("tickets = %d\n", tickets);
    printf("ticketPrice = %d\n", ticketPrice);
    printf("fee = %d\n", fee);
    printf("subtotal = %d\n", subtotal);
    printf("total = %d\n", total);
    printf("valid = %d\n", valid);
    return 0;
}
