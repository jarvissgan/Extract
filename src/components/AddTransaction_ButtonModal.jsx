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
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

const AddTransaction_ButtonModal = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [transaction_amount, setTransactionAmount] = useState(0);
  const [transaction_name, setTransaction_name] = useState("");
  const [errors, setErrors] = useState({});
  const [modalSize, setModalSize] = useState("4xl");
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

  const validateAmount = (transaction_amount) =>
    !isNaN(transaction_amount) && isFinite(Number(transaction_amount));

  const isInvalid = useMemo(() => {
    if (transaction_amount === "") return false;

    return validateAmount(transaction_amount) ? false : true;
  }, [transaction_amount]);

  const onSubmit = async (e) => {
    // console.log("e: ", e);
    e.preventDefault();
    // const data = Object.fromEntries(new FormData(e.currentTarget));

    // if (!data.transaction_amount) {
    //   setErrors({ transaction_amount: "An amount is required" });

    //   return;
    // }

    // if (!data.transaction_name) {
    //   setErrors({ transaction_name: "A transaction name is required" });
    //   return;
    // }
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

      const transaction_uuid = res.data.transaction_uuid;
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

  const expand = () => {
    if (modalSize == "5xl" || "md") {
      setModalSize("5xl");
    } else {
      setModalSize("md");
    }
  };

  return (
    <>
      <Button color="primary" onPress={onOpen}>
        Add Transaction
      </Button>

      <Modal
        isOpen={isOpen}
        size={modalSize}
        placement="top-center"
        onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Add Transactions
              </ModalHeader>
              <ModalBody>
                <Form onSubmit={onSubmit} validationErrors={errors}>
                  <Input
                    autoFocus
                    isRequired
                    label="Transaction Name"
                    name="transaction_name"
                    placeholder="Enter your transaction name"
                    variant="bordered"
                    onValueChange={setTransaction_name}
                  />
                  <Input
                    isRequired
                    label="Amount"
                    name="transaction_amount"
                    placeholder="Enter your transaction Amount"
                    color={isInvalid ? "danger" : ""}
                    variant="bordered"
                    isInvalid={isInvalid}
                    onValueChange={setTransactionAmount}
                  />
                  <Button color="primary" type="submit">
                    Submit
                  </Button>
                  <Button color="primary" onPress={expand}>
                    Expand
                  </Button>
                  <Button color="default" onPress={onClose}>
                    Cancel
                  </Button>
                </Form>
              </ModalBody>
              <ModalFooter />
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default AddTransaction_ButtonModal;
