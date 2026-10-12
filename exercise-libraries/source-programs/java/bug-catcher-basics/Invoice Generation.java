/*
 * @codescope
 * @title Invoice Generation
 * @bug id=bug-1 line=5 token=1 correct="String" wrong="string" choices="string|char"
 * @bug id=bug-2 line=6 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-3 line=7 token=1 correct="double" wrong="Double" choices="Double|float"
 * @bug id=bug-4 line=8 token=5 correct="printf" wrong="Printf" choices="Printf|print"
 * @bug id=bug-5 line=8 token=13 correct="amount" wrong="Amount" choices="Amount|total"
 */
class InvoiceGeneration
{
    public static void main(String[] args)
    {
        String name = "John Doe";
        int id = 12345;
        double amount = 99.99;
        System.out.printf("Invoice for Customer: %s%nOrder ID: %d%nTotal Amount: $%.2f", name, id, amount);
    }
}
