/*
@codescope
@title Integer and Simple If
@seed a min=6 max=10
@seed b min=3 max=7
*/
#include <stdio.h>

int main(void)
{
    int a = 8;
    int b = 5;
    int c;
    int total;

    c = a + b * 2;
    total = c - a;

    if (total > 10)
    {
        total = total + 3;
        c = c - 2;
    }

    printf("a = %d\n", a);
    printf("b = %d\n", b);
    printf("c = %d\n", c);
    printf("total = %d\n", total);

    return 0;
}
