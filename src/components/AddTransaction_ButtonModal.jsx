import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Checkbox,
  Input,
  Link,
  addToast,
  Form,
} from "@heroui/react";
import axiosInstance from "../../api/axios";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

const AddTransaction_ButtonModal = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [transaction_amount, setTransactionAmount] = useState(0);
  const [transaction_name, setTransaction_name] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("placeholder");

  const navigate = useNavigate();
  const routeToPage = (route) => {
    navigate(route, { replace: true });
  };

  //checks if sqid exists
  const sqid = sessionStorage.getItem("sqid");
  if (!sqid) {
    routeToPage("/setup");
  }

  const createTransaction = async (e) => {
    // requires sqid, transaction_name, transaction_amount, transaction_details
    try {
      const res = await axiosInstance.post(`/transaction`, {
        sqid: sqid,
        transaction_name: transaction_name,
        transaction_amount: transaction_amount,
        transaction_details: {
          category: transactionCategory,
        },
      });

      const transaction_uuid = res.data.transaction_uuid
      if (res.status === 200) {
        console.log(`created transaction ${transaction_uuid}`);
        addToast({
          title: "Successfully created transaction",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
        });
      }
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(
          `status ${error.response.status}: ${JSON.stringify(
            error.response.data.error
          )}`
        );
        addToast({
          title: "Unable create transaction, try again",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
        });
      } else if (error.response?.status === 500) {
        addToast({
          title: "Issues Contacting Server, Try again later",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
        });
      } else {
        addToast({
          title: "Unexpected Error Occured",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
        });
        console.error("Error:", error);
      }
    }
  };

  return (
    <>
      <Button color="primary" onPress={onOpen}>
        Add Transaction
      </Button>
      <Form onSubmit={createTransaction}>
        <Modal
          isOpen={isOpen}
          size="4xl"
          placement="top-center"
          onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Add Transactions
                </ModalHeader>
                <ModalBody>
                  <Input
                    autoFocus
                    isRequired
                    label="Transaction Name"
                    placeholder="Enter your transaction name"
                    variant="bordered"
                    onValueChange={setTransaction_name}
                  />
                  <Input
                    isRequired
                    label="Amount"
                    placeholder="Enter your transaction Amount"
                    variant="bordered"
                    onValueChange={setTransactionAmount}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button color="primary" onPress={createTransaction}>
                    Create
                  </Button>
                  <Button color="default" onPress={onClose}>
                    Cancel
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </Form>
    </>
  );
};

export default AddTransaction_ButtonModal;
