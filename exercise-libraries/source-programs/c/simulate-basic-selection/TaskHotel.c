/*
@codescope
@title Integer, If Else and Simple Switch
@seed a min=4 max=8
@seed b min=7 max=11
*/
#include <stdio.h>

int main(void)
{
    int a = 6;
    int b = 9;
    int result;
    int choice;

    result = a * 2 + b;

    if (result > 20) {
        choice = 2;
    } else {
        choice = 1;
    }

    switch (choice)
    {
        case 1:
            result = result + 5;
            a = a + 1;
            break;

        case 2:
            result = result - 7;
            b = b + 2;
            break;

        default:
            result = 0;
    }

    printf("a = %d\n", a);
    printf("b = %d\n", b);
    printf("choice = %d\n", choice);
    printf("result = %d\n", result);

    return 0;
}