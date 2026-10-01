/*
@codescope
@title Unary updates
@seed a min=2 max=12
@seed b min=2 max=12
@seed c min=5 max=15
@seed d min=5 max=15
@seed p min=2 max=9
@seed q min=2 max=9
*/
#include <stdio.h>

int main() {
    int a = 5;
    int b = 5;
    int c = 10;
    int d = 10;

    printf("Initial value of a: %d\n", a);
    printf("Initial value of b: %d\n", b);
    printf("Initial value of c: %d\n", c);
    printf("Initial value of d: %d\n", d);
    printf("\n");

    a--;
    ++b;
    c++;
    --d;

    printf("Updated value of a: %d\n", a);
    printf("Updated value of b: %d\n", b);
    printf("Updated value of c: %d\n", c);
    printf("Updated value of d: %d\n", d);
    printf("\n");

    int p = 4;
    int q = 4;
    int sum = ++p + q++;

    printf("sum = ++p + q++ : %d\n", sum);
    printf("final p: %d\n", p);
    printf("final q: %d\n", q);

    return 0;
}
